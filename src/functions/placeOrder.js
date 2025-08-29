import { app } from "@azure/functions";
import { TableClient} from "@azure/data-tables";

// Uses Azure Functions bindings (extraOutputs) instead of the Storage SDK(queueClient).
// Azure Functions runtime automatically takes care of queue creation, connections, and serialization.

app.http("placeOrder", {
  methods: ["POST"],
  authLevel: "anonymous",
  extraOutputs: [
    {
      name: "orderQueue",
      type: "queue",
      connection: "AzureWebJobsStorage",
      queueName: "orders"
    }
  ],
  handler: async (req, context) => {
    const body = await req.formData();
    const item = body.get("item") || "Unknown item";

    const tableName = "Orders";
      const tableClient = TableClient.fromConnectionString(
        process.env.AzureWebJobsStorage,
        tableName
      );
    
      // Ensure table exists
      await tableClient.createTable();

      const orderEntity = {
        partitionKey: "Orders",
        rowKey: Date.now().toString(), // unique row id
        itemName: item,
        createdAt: new Date().toISOString(),
        status: "Pending"
      };

      await tableClient.createEntity(orderEntity);

    // Push to Azure Queue
    context.extraOutputs.set("orderQueue", {
      item,
      timestamp: new Date().toISOString()
    },
  {
    visibilityTimeout: 300 // 5 minutes = 300 seconds
  });

    return {
      status: 200,
      body: `✅ Order placed for ${item}`
    };
  }
});
