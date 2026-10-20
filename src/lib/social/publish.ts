import { prisma } from "@/lib/db";
import { getDecryptedAccessToken } from "./accounts";
import { getSocialAdapter } from "./registry";
import { checkSocialRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { asArray, asRecord, getErrorMessage } from "@/lib/utils";
import { triggerWorkflows } from "@/lib/workflows/engine";
import type { PostStatus, SocialPlatform } from "@prisma/client";

export class PublishRateLimitError extends Error {
  resetAt: Date;

  constructor(message: string, resetAt: Date) {
    super(message);
    this.name = "PublishRateLimitError";
    this.resetAt = resetAt;
  }
}

async function refreshPostStatus(postId: string) {
  const targets = await prisma.postTarget.findMany({ where: { postId } });
  const statuses = targets.map((target) => target.status);

  let status: PostStatus = "PUBLISHING";
  if (statuses.every((value) => value === "PUBLISHED")) status = "PUBLISHED";
  else if (statuses.some((value) => value === "PUBLISHED")) status = "PARTIAL";
  else if (statuses.every((value) => value === "FAILED")) status = "FAILED";
  else if (statuses.some((value) => value === "PUBLISHING")) status = "PUBLISHING";

  return prisma.post.update({
    where: { id: postId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : undefined
    }
  });
}

export async function publishPostTarget(input: {
  workspaceId: string;
  postId: string;
  socialAccountId: string;
}) {
  const [post, account, target] = await Promise.all([
    prisma.post.findFirst({
      where: { id: input.postId, workspaceId: input.workspaceId }
    }),
    prisma.socialAccount.findFirst({
      where: { id: input.socialAccountId, workspaceId: input.workspaceId }
    }),
    prisma.postTarget.findFirst({
      where: { postId: input.postId, socialAccountId: input.socialAccountId }
    })
  ]);

  if (!post) throw new Error("Post non trovato");
  if (!account) throw new Error("Account social non trovato");
  if (!target) throw new Error("Target del post non trovato");
  if (target.status === "PUBLISHED") {
    return { skipped: true, remotePostId: target.remotePostId };
  }
  if (account.status !== "CONNECTED") {
    throw new Error(`Account ${account.accountName} non connesso (${account.status})`);
  }

  const limit = await checkSocialRateLimit(input.workspaceId, account.platform);
  if (!limit.allowed) {
    throw new PublishRateLimitError(
      `Rate limit ${account.platform}: riprova dopo ${limit.resetAt.toISOString()}`,
      limit.resetAt
    );
  }

  await prisma.postTarget.update({
    where: { id: target.id },
    data: { status: "PUBLISHING", attempts: { increment: 1 }, error: null }
  });
  await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });

  try {
    const adapter = getSocialAdapter(account.platform);
    const accessToken = await getDecryptedAccessToken(account);
    const result = await adapter.publish({
      text: post.body,
      mediaUrls: asArray<string>(post.mediaUrls),
      linkUrl: post.linkUrl,
      accessToken,
      account: {
        id: account.id,
        externalId: account.externalId,
        accountName: account.accountName,
        metadata: asRecord(account.metadata)
      }
    });

    await prisma.postTarget.update({
      where: { id: target.id },
      data: {
        status: "PUBLISHED",
        remotePostId: result.remotePostId,
        publishedAt: new Date(),
        metrics: { url: result.url ?? null }
      }
    });

    await refreshPostStatus(post.id);
    await trackEvent({
      workspaceId: input.workspaceId,
      type: "SOCIAL_POST_PUBLISHED",
      name: `${account.platform} post published`,
      socialPostId: post.id,
      campaignId: post.campaignId,
      metadata: {
        platform: account.platform,
        socialAccountId: account.id,
        remotePostId: result.remotePostId,
        url: result.url ?? null
      }
    });

    await triggerWorkflows({
      workspaceId: input.workspaceId,
      triggerType: "SOCIAL_POST_PUBLISHED",
      context: {
        postId: post.id,
        platform: account.platform,
        socialAccountId: account.id,
        remotePostId: result.remotePostId,
        campaignId: post.campaignId
      }
    }).catch((error) => {
      console.error("[workflow:social-post-published]", getErrorMessage(error));
    });

    return { skipped: false, ...result };
  } catch (error) {
    await prisma.postTarget.update({
      where: { id: target.id },
      data: { status: "FAILED", error: getErrorMessage(error) }
    });
    await refreshPostStatus(post.id);
    throw error;
  }
}

export async function dispatchPostTargets(postId: string, workspaceId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId },
    include: { targets: true }
  });
  if (!post) throw new Error("Post non trovato");
  if (post.targets.length === 0) {
    await prisma.post.update({
      where: { id: post.id },
      data: { status: "FAILED" }
    });
    throw new Error("Il post non ha canali social configurati");
  }

  await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });

  const queued = [];
  const { enqueuePublishPost } = await import("@/lib/queue/queues");
  for (const target of post.targets) {
    if (target.status === "PUBLISHED") continue;
    await prisma.postTarget.update({
      where: { id: target.id },
      data: { status: "PENDING", error: null }
    });
    const job = await enqueuePublishPost({
      workspaceId,
      postId: post.id,
      socialAccountId: target.socialAccountId
    });
    queued.push(job.jobLog.id);
  }
  return { queued: queued.length, jobLogIds: queued };
}

export async function publishDueScheduledPosts(limit = 20) {
  const due = await prisma.post.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true, workspaceId: true, targets: { select: { socialAccountId: true } } },
    orderBy: { scheduledAt: "asc" },
    take: limit
  });

  const dispatched: string[] = [];
  for (const post of due) {
    const claimed = await prisma.post.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: { status: "PUBLISHING" }
    });
    if (claimed.count === 0) continue;

    if (post.targets.length === 0) {
      await prisma.post.update({ where: { id: post.id }, data: { status: "FAILED" } });
      continue;
    }

    const { enqueuePublishPost } = await import("@/lib/queue/queues");
    for (const target of post.targets) {
      await enqueuePublishPost({
        workspaceId: post.workspaceId,
        postId: post.id,
        socialAccountId: target.socialAccountId
      });
    }
    dispatched.push(post.id);
  }

  return { dispatched };
}

export function platformLabel(platform: SocialPlatform) {
  return getSocialAdapter(platform).label;
}
