export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  about_me: string;
  location: string;
  website_url: string;
  reputation: number;
  created_at: string;
  last_seen_at: string;
};

export type Tag = {
  id: number;
  name: string;
  description: string;
  question_count: number;
};

export type Question = {
  id: number;
  author_id: string;
  title: string;
  body: string;
  prompt: string | null;
  artifact_url: string | null;
  score: number;
  view_count: number;
  answer_count: number;
  accepted_answer_id: number | null;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  profiles?: Profile;
  question_tags?: { tags: Tag }[];
};

export type Answer = {
  id: number;
  question_id: number;
  author_id: string;
  body: string;
  prompt: string | null;
  score: number;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
};

export type Comment = {
  id: number;
  post_type: "question" | "answer";
  post_id: number;
  author_id: string;
  body: string;
  score: number;
  created_at: string;
  profiles?: Profile;
};
