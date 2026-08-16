export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: [{ text: string }];
};

export type Source = {
  title: string;
  page: string | null;
  publisher: string | null;
  url: string | null;
  excerpt: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
};

export type WardResult = {
  ward_number: number;
  ward_name: string;
  zone: string | null;
  circle: string | null;
  civic_body: string;
  corporator_status: string | null;
  civic_body_status: string | null;
};
