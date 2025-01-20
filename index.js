require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "https://imaginative-chebakia-1dc907.netlify.app/",
  })
);
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
    // await client.connect();

    const userCollection = client.db("study").collection("users");
    const sessionCollection = client.db("study").collection("sessions");
    const materialCollection = client.db("study").collection("materials");
    const noteCollection = client.db("study").collection("notes");
    const bookedSessionCollection = client
      .db("study")
      .collection("bookedSessions");
    const reviewCollection = client.db("study").collection("reviews");
    const rejectedSessionCollection = client
      .db("study")
      .collection("rejectedSessions");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyTutor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isTutor = user?.role === "tutor";
      if (!isTutor) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/rejectdata", async (req, res) => {
      const rejectData = req.body;
      const result = await rejectedSessionCollection.insertOne(rejectData);
      res.send(result);
    });

    app.get("/rejectdata", verifyToken, verifyTutor, async (req, res) => {
      const result = await rejectedSessionCollection.find().toArray();
      res.send(result);
    });

    app.post("/collectreview", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { reviewSessionId: id };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

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

    app.get("/tutors", async (req, res) => {
      const query = { role: "tutor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;
      const query = { name: { $regex: search, $options: "i" } };
      if (search) {
        const result = await userCollection.find(query).toArray();
        return res.send(result);
      }
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role.role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post("/sessions", async (req, res) => {
      const session = req.body;
      const result = await sessionCollection.insertOne(session);
      res.send(result);
    });

    app.get("/sessionnumber", async (req, res) => {
      const result = await sessionCollection.estimatedDocumentCount();
      res.send({ count: result });
    });

    app.get("/sessions", async (req, res) => {
      console.log(req.headers);
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const query = { status: "approved" };
      const result = await sessionCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/adminsessions", verifyToken, verifyAdmin, async (req, res) => {
      const result = await sessionCollection.find().toArray();
      res.send(result);
    });

    app.patch("/sessionsupdate/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      console.log(data);
      const updateDoc = {
        $set: {
          title: data.title,
          registrationStartDate: data.registrationStartDate,
          registrationEndDate: data.registrationEndDate,
          classStartDate: data.classStartDate,
          classEndDate: data.classEndDate,
          duration: data.duration,
          description: data.description,
        },
      };

      const result = await sessionCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/sessions/:email", verifyToken, verifyTutor, async (req, res) => {
      const email = req.params.email;

      const query = { tutorEmail: email };
      const result = await sessionCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/onesessions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await sessionCollection.findOne(query);
      res.send(result);
    });

    app.get("/bookedsessiondata/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await sessionCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/session/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "pending",
          requested: true,
        },
      };
      const result = await sessionCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/adminup/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: {} };
      if (data.registrationFee !== undefined) {
        updateDoc.$set.registrationFee = data.registrationFee;
      }
      if (data.status !== undefined) {
        updateDoc.$set.status = data.status;
      }
      const result = await sessionCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/sessions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await sessionCollection.deleteOne(query);
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

    app.get("/bookedmeterials/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { sessionId: id };
      const result = await materialCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/materials", verifyToken, verifyAdmin, async (req, res) => {
      const result = await materialCollection.find().toArray();
      res.send(result);
    });

    app.get("/materials/:email", verifyToken, verifyTutor, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await materialCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/materials/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await materialCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/materials/:id", verifyToken, verifyTutor, async (req, res) => {
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

    app.post("/notes", async (req, res) => {
      const note = req.body;
      const result = await noteCollection.insertOne(note);
      res.send(result);
    });

    app.get("/notes/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await noteCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/notes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: data.title,
          description: data.description,
        },
      };
      const result = await noteCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/notes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await noteCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/payment", async (req, res) => {
      const paymentInfo = req.body;
      const query = {
        bookedsessionId: paymentInfo.bookedsessionId,
      };

      const existingPayment = await bookedSessionCollection.findOne(query);
      if (existingPayment) {
        return res.status(400).send({ message: "Payment already exists" });
      }
      const result = await bookedSessionCollection.insertOne(paymentInfo);
      res.send(result);
    });

    app.get("/stop/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        bookedsessionId: id,
      };
      const result = await bookedSessionCollection.findOne(query);
      res.send(result);
    });

    app.get("/payment", async (req, res) => {
      const result = await bookedSessionCollection.find().toArray();
      res.send(result);
    });

    app.get("/bookedsessions/:email", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const email = req.params.email;
      const query = { studentId: email };
      const result = await bookedSessionCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/bookednumber/:email", async (req, res) => {
      const email = req.params.email;
      const query = { studentId: email };
      const result = await bookedSessionCollection.estimatedDocumentCount(
        query
      );
      res.send({ count: result });
    });

    app.get("/tutoremail/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        studentId: email,
      };
      const result = await bookedSessionCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      if (!price || isNaN(price)) {
        return res.status(400).send({ error: "Invalid or missing price" });
      }
      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
