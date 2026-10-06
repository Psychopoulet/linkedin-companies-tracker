import type { Message, MessageResponse } from "../../messages";

export async function sendMessage(message: Message): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message);
}
