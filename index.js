import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import "dotenv/config";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const app = express();
const port = process.env.PORT || 8000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@phero.kuclg9t.mongodb.net/?retryWrites=true&w=majority`;

//middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// making custom middlewares

// middleware for logging full url
const logger = async (req, res, next) => {
  const fullURL = req.protocol + "://" + req.get("host") + req.originalUrl;
  console.log(fullURL);
  next();
};

// middleware to verify token
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Access Denied" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Access Denied" });
    }
    req.user = decoded;
    next();
  });
};

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
    const database = client.db("carDoctor");
    const serviceCollection = database.collection("services");
    const bookingCollection = database.collection("bookings");

    // getAPI for services
    app.get("/services", logger, async (req, res) => {
      const result = await serviceCollection.find({}).toArray();
      res.send(result);
    });

    // getAPI for a specific service
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    // getAPI for all bookings
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      // verifying if the logged in user is trying to access his own token
      if (req?.user?.email !== req?.query?.email) {
        return res.status(402).send({ message: "Unauthorized Access" });
      }
      let query = {};
      if (req.query.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // postAPI for creating a booking
    app.post("/bookings", async (req, res) => {
      const order = req.body;
      const result = await bookingCollection.insertOne(order);
      res.send(result);
    });

    // API for delete booking
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // api for update booking status
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: req.body.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // postAPI for jwt
    app.use("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true, userStatus: "logged in" });
    });

    // clear cookies with token when user is logged out
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("Logging out: ", user);
      res
        .clearCookie("token", { maxAge: 0 })
        .send({ success: true, userStatus: "logged out" });
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => console.log("Server is running in port ", port));
