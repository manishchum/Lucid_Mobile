// User DTOs
export interface User {
  user_id: string;
  email: string;
  name: string;
  company_id: string;
  department_id: string;
  manager_id: string | null;
  position: string;
  phone: string;
  avatar_url: string | null;
  employment_status: string;
  hire_date: string;
  last_login: string | null;
  login_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  title_id: string | null;
  function_id: string | null;
  sub_function_id: string | null;
  ready_status: boolean;
  email_unsubscribed: boolean;
  unsubscribed_at: string | null;
  firebase_uid: string;
}

export interface UserResponse {
  user: User;
}

export interface UserByEmailRequest {
  email: string;
}

// User Roles DTOs
export interface UserRole {
  role_id: string;
  name: string;
  level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  description: string;
  display_name: string;
  permissions: Record<string, boolean>;
}

export interface UserRoleAssignment {
  user_role_assignment_id: string;
  user_id: string;
  role_id: string;
  scope_type: string;
  scope_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string;
  role: UserRole;
}

export interface UserRolesResponse {
  success: boolean;
  assignments: UserRoleAssignment[];
  error: null | string;
}

// Learning Plans DTOs
export interface PlanModule {
  order: number;
  title: string;
  recommended_time: number;
}

export interface PlanJson {
  tips: string;
  modules: PlanModule[];
}

export interface LearningPlan {
  learning_plan_id: string;
  module_id: string;
  assigned_on: string;
  due_date: string | null;
  priority: number;
  plan_json: PlanJson;
  status: string;
  assessment_hash: string;
  reasoning: Record<string, any>;
  training_modules?: { title: string; [key: string]: any };
  processed_module_ids?: string[];
  baseline_assessment?: boolean;
  overall_status?: boolean;
}

export interface LearningPlansResponse {
  plans: LearningPlan[];
}

// Training Modules DTOs
export interface TrainingModule {
  module_id: string;
  company_id: string;
  title: string;
  description: string;
  content_type: string;
  content_url: string;
  gpt_summary: string;
  created_at: string;
  transcription: string | null;
  ai_modules: string;
  ai_topics: string;
  ai_objectives: string;
  processing_status: string;
  threshold_value: number;
  review_stage: string;
  reviewer_id: string | null;
  uploaded_by: string;
  additional_readings: string | null;
  source_files: string[];
  ingestion_status: string;
  page_count: number | null;
  match_chunks: any | null;
}

export interface TrainingModulesResponse {
  modules: TrainingModule[];
}

// Module Progress DTOs
export interface ModuleProgressEntry {
  module_progress_id: string;
  started_at: string;
  completed_at: string | null;
  quiz_score: number | null;
  quiz_feedback: string | null;
  viewed_at: string | null;
  audio_listen_duration: number | null;
  processed_module_id: string;
  user_id: string;
  pass_status: string | null;
  processed_modules?: {
    title: string;
    learning_style: string;
    original_module_id: string;
  };
}

export interface ModuleProgress {
  progress: ModuleProgressEntry[];
  count: number;
}

// Company DTOs
export interface Company {
  company_id: string;
  name: string;
  domain: string;
  created_at: string;
  learning_style: boolean;
  rate_limit_role_play: number;
  rate_limit_content_generation: number;
  rate_limit_role_play_retries: number;
  rag_temperature?: number;
  rag_chunk_size?: number;
  rag_chunk_overlap?: number;
  rag_top_p?: number;
  rag_max_output_tokens?: number;
  company_logo?: string | null;
  subscription_tier?: string;
  subscription_addons?: string[];
}

export interface CompanyResponse {
  success: boolean;
  data: Company;
  error: null | string;
}

// Learning Style DTOs
export interface LearningStyle {
  learning_style: string;
  gpt_analysis: string | null;
}

export interface LearningStyleResponse {
  success: boolean;
  data: LearningStyle;
}

// Company Users DTOs
export interface CompanyUsersResponse {
  success: boolean;
  data: {
    users: User[];
  };
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
};

export type PostModuleChatDto = {
  processed_module_id: string;
  user_message: string;
  user_id: string;
  company_id: string;
  chat_history: ChatMessage[];
};

export type PostModuleChatResponseDto = {
  success: boolean;
  message: string;
};

export interface UserRankData {
  rank: number | null;
  top_percentile: number | null;
  modules_completed: number;
}

export interface DashboardSummaryResponse {
  plans: any[];
  modules: any[];
  progress: any[];
  company: any | null;
  learning_style: string | null;
  assessment_evidence_by_module_id: Record<string, any[]>;
  baseline_evidence_by_module_id?: Record<string, any[]>;
  user_rank: UserRankData | null;
  total_users: number;
}

// Task Manager DTOs
export type SubmissionFormat =
  | "audio"
  | "image"
  | "video"
  | "text"
  | "multiple_choice"
  | "bundle";

export interface TaskQuestion {
  id: string;
  type: "single" | "multiple";
  options: string[];
  question: string;
  correctAnswer?: string;
  writtenAnswer?: string;
  correctAnswers?: string[];
}

export interface BundleTask {
  title: string;
  description?: string;
  questions: TaskQuestion[];
  submission_format: SubmissionFormat | SubmissionFormat[];
  child_task_id?: string | null;
  expected_answer?: string | null;
}

export interface TaskSubmission {
  text_response?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  answers?: TaskAnswer[] | null;
  score?: number | null;
  max_score?: number | null;
  submitted_at?: string | null;
  [key: string]: any;
}

export interface Task {
  task_id: string;
  assignment_id: string;
  company_id: string;
  title: string;
  description?: string | null;
  expected_answer?: string | null;
  submission_format: SubmissionFormat[];
  questions: TaskQuestion[];
  bundle_tasks: BundleTask[];
  status: string;
  due_date: string | null;
  recurrence: string;
  level: string;
  audience_display_name: string;
  total_target_count: number;
  completion_count: number;
  created_at: string;
  submitted: boolean;
  submission: TaskSubmission | null;
  priority?: string | null;
  assigned_to?: string | null;
  updated_at?: string;
  [key: string]: any;
}

export interface TasksResponse {
  total: number;
  tasks: Task[];
}

/** Internal submission the app can collect for a single format slot */
export type TaskSubmissionType =
  | "image"
  | "text"
  | "video"
  | "audio"
  | "options";

export type TaskSubmissionWireType =
  | "image"
  | "text"
  | "video"
  | "audio"
  | "multiple_choice";

export interface TaskAnswer {
  question_id: string;
  question: string;
  correct_answer?: string;
  selected_option?: string;
  selected_options?: string[];
}

export interface FormatAnswer {
  format: SubmissionFormat;
  text_answer?: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  answers?: TaskAnswer[];
}

export interface BundleSubmissionEntry {
  title: string;
  answers: FormatAnswer[];
}

export interface TaskSubmissionPayload {
  assignment_id: string;
  task_id: string;
  user_id: string;
  max_score: number;
  score: number;
  is_bundle?: boolean;
  answers?: FormatAnswer[];
  bundle_answers?: BundleSubmissionEntry[];

  submission_type?: TaskSubmissionType;
  image_url?: string;
  text_answer?: string;
  video_url?: string;
  audio_url?: string;
  /** @deprecated use `answers` — kept for backwards compatibility */
  selected_options?: string[];
}

export interface TaskSubmissionResponse {
  message: string;
  status: string;
  submission_id: string;
}

export interface LeaderboardUser {
  user_id: string;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  completion_percentage: number;
  modules_completed: number;
  modules_assigned: number;
  rank: number;
}

export interface UserRankInfo {
  rank: number | null;
  top_percentile: number | null;
  modules_completed: number;
}

export interface LeaderboardHighlightData {
  top_performers: LeaderboardUser[];
  user_rank_info: UserRankInfo | null;
  total_users: number;
  user_in_top: boolean;
}

export interface LeaderboardHighlightResponse {
  success: boolean;
  data: LeaderboardHighlightData;
  error: string | null;
}
