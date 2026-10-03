export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
};

export type GmailAlert = {
  id: string;
  text: string;
  from: string;
  subject: string;
};
