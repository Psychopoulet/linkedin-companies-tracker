// deps

  // locals
  import type { Message, MessageResponse } from "../../messages";

// module

export async function sendMessage (message: Message): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message);
}
