const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
// lets you create clients to talk to Blob Storage.
const Busboy = require('busboy');

// 🔹 What problem are we solving?
// When a client (browser, app, etc.) uploads a file:
// The request body isn’t just a raw image or buffer.
// Instead, it comes in a multipart format, which contains:
//   File content (binary data in chunks)
//   Metadata like filename, mimetype
//   Other form fields (text, numbers, etc.)

// If you simply do await request.text() or await request.arrayBuffer(), you’ll just get the raw multipart body, which is messy and not usable directly.
// That’s where Busboy comes in.

// 🔹 Why Busboy?
// Busboy is a streaming parser for multipart/form-data.
// It does the heavy lifting of parsing the multipart request into:
// file events → gives you access to the uploaded file’s binary stream
// field events → gives you regular form fields (like name, age)
// Metadata (filename, mimeType, etc.)


const { Readable } = require('stream');

app.http('uploadImage', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const AZURE_STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage.trim();
      const containerName = 'menu';
      const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();

      // ✅ read body as Buffer (works for multipart uploads)
      const arrayBuffer = await request.arrayBuffer();
      const bodyBuffer = Buffer.from(arrayBuffer);
      // Convert to a Node Buffer so you can feed it into Busboy.

      await new Promise((resolve, reject) => {
        const contentType = request.headers.get("content-type");
        // Busboy must know the exact content-type header
        if (!contentType) return reject(new Error("Content-Type header missing"));

        const busboy = Busboy({ headers: { 'content-type': contentType } });
        // Initializes Busboy with the request’s Content-Type so it knows how to parse the multipart body.
        
        // fieldname: the form field name (e.g., "image").
        // file: a Readable stream of the file bytes.
        // info: has the original filename and detected mimeType.
        busboy.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;
        const uniqueName = `${Date.now()}-${filename}`;

        const blobClient = containerClient.getBlockBlobClient(uniqueName);
        const chunks = [];

        // Collects stream data chunks in memory, then on end:
        // Combines them with Buffer.concat(...).
        // Uploads to Blob Storage using uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimeType } }), which also sets the blob’s Content-Type.
        file.on('data', chunk => chunks.push(chunk));
        file.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          await blobClient.uploadData(buffer, {
          blobHTTPHeaders: { blobContentType: mimeType }
          // If you don’t set the blobContentType, anyone downloading the file later won’t know if it’s an image, PDF, video, etc.
        });
  });
});


        busboy.on('finish', resolve);
        busboy.on('error', reject);

        // ✅ feed buffer into busboy
        // Azure gives us the request body as a buffer.
        //  Busboy needs a stream to parse multipart data.
        // So we convert the buffer → stream, then pipe it into Busboy for proper parsing.
        const stream = Readable.from(bodyBuffer);   //take this Buffer and pretend it’s a file stream, so Busboy can process it like it normally would.
        stream.pipe(busboy);
      });

      return { status: 200, body: 'Upload successful' };
    } catch (err) {
      console.error("Upload error:", err);
      return { status: 500, body: 'Error uploading image' };
    }
  }
});

// Imagine you are sending a parcel 📦
//  You (the client/browser) are uploading a file (say, pizza.png) to your server (Azure Function).
//  That file doesn’t arrive all at once (like magic) — it arrives piece by piece (chunks) over the internet.
// What happens in your code:
//  File arrives in small pieces → file.on('data', chunk => ...)
//  Each little piece of the file (like tearing a book into small pages and sending them) is called a chunk.

// You collect all those pages into a box called chunks[].
// 👉 So after the file is fully uploaded, chunks = [piece1, piece2, piece3, ...].
// When the file is fully received → file.on('end', ...)
// This means all the small pieces (chunks) have arrived.
// Now you glue them back together into one big file again:
// const buffer = Buffer.concat(chunks);

// Think of Buffer as a “box of bytes” that represents the whole file content in memory.
// Upload that file into Azure Blob Storage → blobClient.uploadData(buffer, {...})
// You now take the complete file (the glued-together buffer) and send it to Azure Blob Storage.
// Azure stores it as a blob (like saving it in a special folder in the cloud).
// Tell Azure what type of file it is → blobHTTPHeaders: { blobContentType: mimeType }
// Example: "image/png", "application/pdf", "video/mp4".
// This is important because:
// If you later click the file link in a browser and it’s an image, the browser will show it as an image.
// If you don’t set this, the browser won’t know what the file is, and may just force a “download” instead of opening it.
// ⚡ Putting it all together:
// pipe → means “send data from one stream to another.” Here we pipe the incoming HTTP request into Busboy, which knows how to “read” file uploads.
// Busboy → listens to the request and gives you a file stream (the uploaded file flowing in pieces).
// chunks → small pieces of the file you collect while it streams in.
// Buffer → the complete file in memory, after you glue the chunks back together.
// uploadData(buffer) → sends that complete file to Azure Blob Storage.
// mimeType → a label that tells Azure (and later, browsers) what kind of file it is.




// const { app } = require('@azure/functions');
// const { BlobServiceClient } = require('@azure/storage-blob');
// const Busboy = require('busboy');

// app.http('uploadImage', {
//   methods: ['POST'],
//   authLevel: 'anonymous',
//   handler: async (context, req) => {
//     try {
//       const AZURE_STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage.trim();
//       const containerName = 'menu';
//       const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
//       const containerClient = blobServiceClient.getContainerClient(containerName);
//       await containerClient.createIfNotExists();

//       await new Promise((resolve, reject) => {
//   const busboy = Busboy({ headers: req.headers });

//   busboy.on('file', async (fieldname, file, filename) => {
//     const blobClient = containerClient.getBlockBlobClient(filename);
//     const chunks = [];
//     file.on('data', chunk => chunks.push(chunk));
//     file.on('end', async () => {
//       const buffer = Buffer.concat(chunks);
//       await blobClient.uploadData(buffer, {
          // blobHTTPHeaders: { blobContentType: mimeType }
          // If you don’t set the blobContentType, anyone downloading the file later won’t know if it’s an image, PDF, video, etc.
        // });
//     });
//   });

//   busboy.on('finish', resolve);
//   busboy.on('error', reject);

//   // pipe the incoming request stream
//   req.pipe(busboy);
// });


//       return { status: 200, body: 'Upload successful' };
//     } catch (err) {
//       console.error(err);
//       return { status: 500, body: 'Error uploading image' };
//     }
//   }
// });
