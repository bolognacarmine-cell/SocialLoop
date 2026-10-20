export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "exists"
  | "not_exists"
  | "in"
  | "not_in";

export type Condition = {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean | string[] | null;
};

export type ConditionGroup = {
  match: "all" | "any";
  rules: Condition[];
};

export type WorkflowAction =
  | { type: "send_email"; templateId?: string }
  | { type: "add_tag"; tagName?: string }
  | { type: "remove_tag"; tagName?: string }
  | { type: "update_score"; amount?: number; reason?: string }
  | { type: "set_stage"; stage?: string }
  | { type: "add_to_segment"; segmentId?: string }
  | {
      type: "add_to_retargeting";
      audienceName?: string;
      platform?: string;
      campaignId?: string;
    }
  | {
      type: "create_social_post";
      body?: string;
      socialAccountIds?: string[];
      scheduledInMinutes?: number;
      campaignId?: string;
    }
  | { type: "send_webhook"; url?: string };

export type WorkflowDelay = {
  amount: number;
  unit: "minutes" | "hours" | "days";
};

export type WorkflowStep = {
  id: string;
  type: "condition" | "action" | "delay";
  condition?: ConditionGroup;
  action?: WorkflowAction;
  delay?: WorkflowDelay;
};

export type WorkflowContext = Record<string, unknown> & {
  tags?: string[];
};

export type TriggerConfig = ConditionGroup & {
  tag?: string;
  stage?: string;
  minScore?: number;
};
