const express = require("express");
const app = express();
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.q7sgz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// const uri = "mongodb+srv://<db_username>:<db_password>@cluster0.q7sgz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("study").collection("users");
    const sessionCollection = client.db("study").collection("sessions");
    const materialCollection = client.db("study").collection("materials");

    app.post("/users", async (req, res) => {
      const user = req.body;
      query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.post("/sessions", async (req, res) => {
      const session = req.body;
      const result = await sessionCollection.insertOne(session);
      res.send(result);
    });

    app.get("/sessions/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { tutorEmail: email };
      const result = await sessionCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/session/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      console.log(filter);
      const updateDoc = {
        $set: {
          status: "pending",
          requested: true,
        },
      };
      const result = await sessionCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/materials", async (req, res) => {
      const material = req.body;
      const query = { sessionId: material.sessionId };
      const existingMaterial = await materialCollection.findOne(query);
      if (existingMaterial) {
        return res.status(400).send({ message: "Material already exists" });
      }
      const result = await materialCollection.insertOne(material);
      res.send(result);
    });

    app.get("/materials", async (req, res) => {
      const result = await materialCollection.find().toArray();
      res.send(result);
    });

    app.delete("/materials/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await materialCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/materials/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          materialimage: data.materialimage,
          link: data.link,
        },
      };
      const result = await materialCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from test server");
});

app.listen(port, () => {
  console.log(`Listening to port ${port}`);
});
