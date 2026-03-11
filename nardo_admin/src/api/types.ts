export type Service = {
  id: number;
  slug: string;
  title: string;
  is_active: boolean;
  sort: number;
  start_question_id?: number | null;
};

export type BotText = { key: string; value: string; photo_path?: string | null };

export type QuestionType = "text" | "single_choice" | "phone" | "email";

export type AdminShort = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_emoji?: string | null;
};

export type LeadSource = "bot" | "webapp";

export type QuestionOption = {
  id: number;
  question_id: number;
  text: string;
  value: string;
  sort: number;
  keyboard_row: number;
  keyboard_col: number;
  next_question_id: number | null;
  ends_flow: boolean;
  is_archived: boolean;
};

export type Question = {
  id: number;
  service_id: number;
  code: string;
  text: string;
  qtype: QuestionType;
  is_required: boolean;
  sort: number;
  next_question_id: number | null;
  ends_flow: boolean;
  pos_x: number;
  pos_y: number;
  photo_path: string | null;
  is_archived: boolean;
  options: QuestionOption[];
};

export type LeadsListItem = {
  id: number;
  service_title: string;
  user_id: number;
  user_tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_file_id: string | null;
  started_at: string;
  submitted_at: string | null;
  status:
    | "filling"
    | "abandoned"
    | "awaiting_review"
    | "in_review"
    | "confirmed"
    | "in_work"
    | "paused"
    | "rejected"
    | "lost"
    | "studio_cancelled"
    | "done"
    | "delivered"
    | "client_not_confirmed"
    | "closed";
  source?: LeadSource | null;
  accepted_at?: string | null;
  accepted_by_admin?: AdminShort | null;
};

export type LeadDetails = {
  id: number;
  user_id: number;
  service_id: number;
  service_title?: string;
  user?: {
    id: number;
    tg_id: number | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    photo_file_id: string | null;
  };
  status:
    | "filling"
    | "abandoned"
    | "awaiting_review"
    | "in_review"
    | "confirmed"
    | "in_work"
    | "paused"
    | "rejected"
    | "lost"
    | "studio_cancelled"
    | "done"
    | "delivered"
    | "client_not_confirmed"
    | "closed";
  source?: LeadSource | null;
  started_at: string;
  submitted_at: string | null;
  accepted_at?: string | null;
  accepted_by_admin?: AdminShort | null;
  project_id?: number | null;
  answers: { id: number; question: string; answer: string; has_photo?: boolean }[];
  events?: {
    id: number;
    from_status: string | null;
    to_status: string | null;
    created_at: string | null;
    admin?: AdminShort | null;
  }[];
};

export type ProjectListItem = {
  id: number;
  lead_id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  notes_count: number;
  files_count: number;
  lead_status: LeadsListItem["status"];
  service_title: string;
  user: {
    id: number;
    tg_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };
};

export type ProjectNote = {
  id: number;
  body: string;
  created_at: string;
  admin?: AdminShort | null;
};

export type ProjectFile = {
  id: number;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  admin?: AdminShort | null;
};

export type ProjectDetails = {
  id: number;
  lead_id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    id: number;
    status: LeadsListItem["status"];
    service_title: string;
    user: {
      id: number;
      tg_id: number | null;
      username: string | null;
      first_name: string | null;
      last_name: string | null;
    };
  } | null;
  notes: ProjectNote[];
  files: ProjectFile[];
};

export type UserItem = {
  id: number;
  tg_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  support_enabled: boolean;
  support_enabled_until?: string | null;
  support_admin?: AdminShort | null;
  photo_file_id: string | null;
  active_lead_id: number | null;
  active_service_title: string | null;
  active_question_text: string | null;
  updated_at: string | null;
  unread_count?: number | null;
};

export type ChatMessage = {
  id: number;
  direction: "inbound" | "outbound";
  text: string;
  tg_message_id: number | null;
  admin_tg_id: number | null;
  admin_id?: number | null;
  admin?: AdminShort | null;
  created_at: string;
  seen_at?: string | null;
  admin_seen_at?: string | null;
};
