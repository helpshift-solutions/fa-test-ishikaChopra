import { app } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";

const queueClient = new QueueClient(
  process.env.AzureWebJobsStorage,
  "orders"
);

// Runs every 1 minute
app.timer("deleteOldMessages", {
  schedule: "0 */1 * * * *", // cron expression → every 1 minute
  handler: async (myTimer, context) => {
    const messages = await queueClient.receiveMessages({ numberOfMessages: 32 });

    if (!messages.receivedMessageItems.length) {
      context.log("No messages found.");
      return;
    }

    const now = new Date();

    for (const msg of messages.receivedMessageItems) {
      const enqueuedTime = new Date(msg.insertedOn); // when it was added
      const ageInMinutes = (now - enqueuedTime) / (1000 * 60);

      if (ageInMinutes >= 10) {
        await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
        context.log(`Deleted message ${msg.messageId} (age: ${ageInMinutes} min)`);
      }
    }
  }
});

