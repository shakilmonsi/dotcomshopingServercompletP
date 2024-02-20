const express = require("express");
const app = express();

const jwt = require("jsonwebtoken");

const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fm710lc.mongodb.net/todoapp?retryWrites=true&w=majority`;
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
    const menuCollection = client
      .db("onlineshoping")
      .collection("menuCollection");
    const reviewCollection = client.db("onlineshoping").collection("reviews");

    const emajhonCollection = client.db("onlineshoping").collection("emaJohn");

    const usersCollection = client.db("onlineshoping").collection("users");
    const cartCollection = client.db("onlineshoping").collection("carts");








    // API endpoint for paginated products
    app.get("/api/products", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 10;

        const totalProducts = await emajhonCollection.countDocuments();
        const totalPages = Math.ceil(totalProducts / perPage);

        const products = await emajhonCollection
          .find()
          .skip((page - 1) * perPage)
          .limit(perPage);

        res.json({
          products,
          totalPages,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    //__________________________verifyJWT___________________________________________________

    // use verify admin after verifyToken
    // const verifyAdmin = async (req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   const isAdmin = user?.role !== 'admin';
    //   if (!isAdmin) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }
    //   next();
    // }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      next();
    };

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //1,____________________________ jwt related api_____________________________________________
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // suers get api   18/1/24
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //__________________________verifyJWT___________________________________________________

    //2._______________________ admin  section ok _____________________________________________________________

    //____________check admin____________
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //_____________ make admin ______________

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //2._______________________________admin  section ok_____________________________________________________

    // suers api   18/1/24
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log("userPost", user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already ecists" });
      }

      try {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // app.get('/menu', async (req, res) => {
    //   const result = await menuCollection.find().toArray();
    //   res.send(result);
    // })

    //_________________________ menu setup _______________________________________________

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.get("/menu", async (req, res) => {
      const query = {};
      const curser = menuCollection.find(query);
      const datacart = await curser.toArray();
      res.send(datacart);
    });

    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    //__________ userHome and admin Home setup  _________________________

    app.get("/adminstats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const reviews = await reviewCollection.estimatedDocumentCount();

      // best way to sum of a fiald is to user grop  ok

      //___________  payments setupa korar   tp   __________
      // const payments = await paymentsCollectrion.find().toArray()
      // const revenue = payments.reduce((sum, payment)=> sum + payment.price,0)

      // const orders = await pay

      res.send({ users, products, reviews });
    });
    //__________ userHome and admin Home setup  _________________________

    //__________ recharts and admin Home setup  _________________________

    // using aggregate pipeline
    app.get("/orderstats", async (req, res) => {
      const result = await cartCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menu",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    //__________ recharts and admin Home setup  _________________________

    //____________________________menu setup _____________________________________________________
    /// my testing code query   section
    // app.get("/menu/:id",async(req,res)=> {
    //   const id =req.params.id;
    //   const query= {_id: ObjectId(id)}
    //   const   mentPriduct = await cartCollection.findOne(query)
    //   res.send(mentPriduct)
    //  })

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;

      // Validate if the ID is a valid ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }

      const query = { _id: new ObjectId(id) };

      try {
        const menuProduct = await menuCollection.findOne(query);
        if (menuProduct) {
          res.send(menuProduct);
        } else {
          res.status(404).send({ error: "Product not found" });
        }
      } catch (error) {
        console.error("Error fetching menu product:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    //_____________________ cart api and verifytoken______________________________________
    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      // ___________new code__check real users__________
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "nuauthorizes access" });
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    //_____________________ cart api and verifytoken______________________________________

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      console.log(cartItem);
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //___________________________________ pastion_________________________________________________________________________________

    app.get("/products", async (req, res) => {
      console.log(req.query);
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const skip = page * limit;

      const result = await emajhonCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/totalProducts", async (req, res) => {
      const result = await emajhonCollection.estimatedDocumentCount();
      res.send({ totalProducts: result });
    });

    app.post("/productsByIds", async (req, res) => {
      const ids = req.body;
      const objectIds = ids.map((id) => new ObjectId(id));
      const query = { _id: { $in: objectIds } };
      console.log(ids);
      const result = await emajhonCollection.find(query).toArray();
      res.send(result);
    });

    //_______________________________________pasion___________________________________________________________________________________________

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
  res.send("boss is sitting");
});

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
});

/**
 * --------------------------------
 *      NAMING CONVENTION
 * --------------------------------
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.put('/users/:id')
 * app.patch('/users/:id')
 * app.delete('/users/:id')
 *
 */
