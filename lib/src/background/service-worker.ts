// deps

  // locals
  import { REGISTRY_UPDATED } from "../messages";
  import {
    addCompany,
    broadcastRegistryUpdate,
    deleteCompany,
    getRegistry,
    replaceRegistry,
    updateCompany
  } from "./storage";
  import { isValidCompany } from "../types/company";
  import { REGISTRY_STORAGE_KEY } from "../storage/constants";

// types & interfaces

  // locals
  import type { Message, MessageResponse } from "../messages";

// private

  // methods
  async function _handleMessage (message: Message): Promise<MessageResponse> {

    switch (message.type) {

      case "GET_REGISTRY": {
        const registry = await getRegistry();
        return { "ok": true, registry };
      }

      case "ADD_COMPANY": {
        if (!isValidCompany(message.company)) {
          return { "ok": false, "error": "Invalid data: name is required." };
        }
        const registry = await addCompany(message.company);
        await broadcastRegistryUpdate();
        return { "ok": true, registry };
      }

      case "UPDATE_COMPANY": {
        if (!isValidCompany(message.company)) {
          return { "ok": false, "error": "Invalid data: name is required." };
        }
        try {
          const registry = await updateCompany(message.company);
          await broadcastRegistryUpdate();
          return { "ok": true, registry };
        }
        catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return { "ok": false, "error": errorMessage };
        }
      }

      case "DELETE_COMPANY": {
        const registry = await deleteCompany(message.linkedinCode);
        await broadcastRegistryUpdate();
        return { "ok": true, registry };
      }

      case "IMPORT_REGISTRY": {
        if (!Array.isArray(message.companies) || !message.companies.every(isValidCompany)) {
          return { "ok": false, "error": "Invalid data: one or more companies are incorrect." };
        }
        const registry = await replaceRegistry(message.companies);
        await broadcastRegistryUpdate();
        return { "ok": true, registry };
      }

      default:
        return { "ok": false, "error": "Unknown message" };

    }

  }

// module

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {

    _handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        sendResponse({ "ok": false, "error": errorMessage });
      });

    return true;

  }
);

chrome.storage.onChanged.addListener((changes, areaName) => {

  if ("local" === areaName && REGISTRY_STORAGE_KEY in changes) {

    broadcastRegistryUpdate().catch(() => {
      // Ignore broadcast failures.
    });

  }

});

chrome.runtime.onInstalled.addListener(() => {
  console.info(`[${REGISTRY_UPDATED}] Extension installed`);
});
