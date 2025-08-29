const { app } = require('@azure/functions');
// Pulls in the Azure Functions runtime API so you can register HTTP triggers like app.http(...).
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { StorageSharedKeyCredential } = require('@azure/storage-blob');

const accountName = "satesting00";
const accountKey = process.env.AZURE_STORAGE_KEY; // must set in env
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
// generate SAS tokens securely, signed with with account key

app.http('home', {
  methods: ['GET'],
  authLevel: 'anonymous', // allows public access
  handler: async (request, context) => {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage;
    console.log("Connection string:", AZURE_STORAGE_CONNECTION_STRING);

    const containerName = "menu"; // your blob container

    // BlobServiceClient is the main entry point to work with an Azure Storage account.
    // BlobServiceClient.fromConnectionString() -> creates a client object using the connection string (which includes your account name & key).
    // Once you have blobServiceClient, you can: List all containers , Create or delete containers , Get a specific container client
    // blobServiceClient -> containerClient -> blobClient
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    let imagesHtml = "";
    for await (const blob of containerClient.listBlobsFlat()) {
  const blobClient = containerClient.getBlobClient(blob.name);

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: blob.name,
      permissions: BlobSASPermissions.parse("r"), // read access
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hr expiry
    },
    sharedKeyCredential
  ).toString();

  // Works only if the container or blob is public:
  // const blobUrl = `${containerClient.url}/${blob.name}`;

  const blobUrl = `${blobClient.url}?${sasToken}`;

  imagesHtml += `<div><img src="${blobUrl}" width="200"><p>${blob.name}</p></div>`;
}

    const html = `
      <html>
        <body>
          <h1>Welcome to Cup N Crave</h1>
          ${imagesHtml}
          <form action="/api/placeOrder" method="POST">
            <input type="text" name="item" placeholder="Enter item name" required />
            <button type="submit">Place Order</button>
          </form>
          <form action="/api/uploadImage" method="POST" enctype="multipart/form-data">
  <input type="file" name="image" accept="image/*" required />
  <button type="submit">Upload Image</button>
</form>

        </body>
      </html>
    `;

    return {
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: html
    };
  }
});

// WE CANNOT STORE PLAIN JSON DIRECTLY IN QUEUE , SO WE STORE BASE-24 ENCODED STRING JSON
