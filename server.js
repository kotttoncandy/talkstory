const { Server } = require("socket.io");
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId, } = require("mongodb");
const { createServer } = require("node:http");
const { v4: uuidv4 } = require("uuid")
const WebSocket = require('ws');
// MongoDB connection URI
const uri =
  "mongodb+srv://admin:Lolking0912@cluster0.zw3b3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

var clients = {}

const app = express();
const server = createServer(app);
const port = 3000;
let stories = {}; // Global variable to hold MongoDB data
const wss = new WebSocket.Server({ server });
app.use(cors());
app.use(express.json());

// Function to fetch data from MongoDB
async function updateStories() {
  try {
    await client.connect();
    const database = client.db("stories");
    const collections = await database.listCollections().toArray(); // List all collections

    collections.forEach(async (collection) => {
      const collectionName = collection.name;
      const collectionData = await database
        .collection(collectionName)
        .find({})
        .toArray();
      stories[collectionName] = collectionData;

      for (const b in clients) {
        if (collectionName != clients[b]["activeStory"]) {
          const c = database.collection(collection.name);

          // Update document with matching `id`
          const result = await c.updateOne(
            { _id: new ObjectId(collectionData[0]["_id"]) },
            { $set: { isActive: false } } // Update the document with new data
          );
        }
      }

      if (collectionData[0]["story"].length > 7 && !collectionData[0]["isFull"]) {
        try {
          // Connect to MongoDB and update the document
          const c = database.collection(collection.name);

          // Update document with matching `id`
          const result = await c.updateOne(
            { _id: new ObjectId(collectionData[0]["_id"]) },
            { $set: { isFull: true } } // Update the document with new data
          );

          if (result.matchedCount === 0) {
            console.log("Document not found");
          }

          const newCollection = await database.createCollection(String(collections.length));


          const document = {
            _id: ObjectId.createFromTime(Date.now()),  // Correct use of ObjectId to create a time-based _id
            story: ["Once Upon A Time"],
            isActive: false,
            isFull: false
          };

          await newCollection.insertOne(document)


        } catch (err) {
          console.error("Error updating document:", err);
        }
      }
    });


  } catch (err) {
    console.error("Error fetching data from MongoDB:", err);
  }
}

// Initial call to update stories
updateStories();

app.get("/", (req, res) => {

  res.json(stories);

});

wss.on('connection', function connection(ws) {

  const clientId = uuidv4();
  console.log(`Client connected with ID: ${clientId}`);

  // Store the client in the clients object
  clients[clientId] = {
    activeStory: null,
    storyID: null
  };

  ws.send(clientId);

  ws.on('close', async function close() {
    console.log('Client disconnected');

    if (clients[clientId].activeStory != null) {
      try {
        // Connect to MongoDB and update the document
        const database = client.db("stories");
        const collection = database.collection(clients[clientId].activeStory);

        // Update document with matching `id`
        const result = await collection.updateOne(
          { _id: new ObjectId(clients[clientId].storyID) },
          { $set: { isActive: false } } // Update the document with new data
        );

        if (result.matchedCount === 0) {
          console.log("Document not found");
        }

        console.log("Document updated successfully");
      } catch (err) {
        console.error("Error updating document:", err);
        console.log("Error updating document");
      }
    }
    delete clients[clientId]
  });

});

// Set a periodic interval to keep updating stories every 100ms
setInterval(updateStories, 1000); // Update stories every 100ms, if needed

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.post("/submit", async (req, res) => {
  const data = req.body;
  console.log(`${data.clientID} ${data.type}`)

  if (data.type == "isActive") {

    try {
      // Connect to MongoDB and update the document
      const database = client.db("stories");
      const collection = database.collection(data.name);

      // Update document with matching `id`
      const result = await collection.updateOne(
        { _id: new ObjectId(data.id) },
        { $set: { isActive: true } } // Update the document with new data
      );

      if (result.matchedCount === 0) {
        console.log("Document not found");
      }


      console.log("Document updated successfully");
      clients[data.clientID].activeStory = data.name
      clients[data.clientID].storyID = data.id
    } catch (err) {
      console.error("Error updating document:", err);
      console.log("Error updating document");
    }
  } else if (data.type == "updateStory") {
    try {
      // Connect to MongoDB and update the document
      const database = client.db("stories");
      const collection = database.collection(data.name);

      // Update document with matching `id`
      const result = await collection.updateOne(
        { _id: new ObjectId(data.id) },
        { $push: { story: data.value } } // Update the document with new data
      );

      if (result.matchedCount === 0) {
        console.log("Document not found");
      }

      console.log("Document updated successfully");
      clients[data.clientID].activeStory = data.name
      clients[data.clientID].storyID = data.id

    } catch (err) {
      console.error("Error updating document:", err);
      console.log("Error updating document");
    }
  } else if (data.type == "createNewStory") {
    const database = client.db("stories");
    const collections = await database.listCollections().toArray(); // List all collections

    const newCollection = await database.createCollection(String(collections.length));


    const document = {
      _id: ObjectId.createFromTime(Date.now()),  // Correct use of ObjectId to create a time-based _id
      story: ["Once upon a time..."],
      isActive: false,
      isFull: false
    };

    await newCollection.insertOne(document)
  }
});
