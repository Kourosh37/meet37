export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  createdAt: string;
}

export interface FileMessage {
  id: string;
  from: string;
  filename: string;
  size: number;
  downloadUrl: string;
}

export type RoomDataMessage =
  | {
      type: 'chat';
      payload: ChatMessage;
    }
  | {
      type: 'file';
      payload: FileMessage;
    };
