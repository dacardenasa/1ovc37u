const express = require("express");
const mongoose = require("mongoose");
const Note = require("./models/Note");
const Pageview = require("./models/Pageview");
const path = require("path");
const md = require("marked");

const app = express();

mongoose.connect(process.env.MONGODB_URL || "mongodb://localhost:27017/notes", {
  useNewUrlParser: true,
});

app.set("view engine", "pug");
app.set("views", "views");

app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static(path.join(__dirname, "assets")));

const registerView = async (req, res, next) => {
  const pageview = new Pageview({
    path: req.path,
    userAgent: req.header("User-Agent"),
  });

  try {
    await pageview.save();
    next();
  } catch (error) {
    return handleError(error);
  }
};

app.get("/", registerView, async (req, res) => {
  const notes = await Note.find();
  res.render("index", { notes: notes });
});

app.get("/analytics", registerView, async (req, res) => {
  const visits = await Pageview.find();
  let path = [];
  let analyticsData = [];

  let filterVisits = visits.filter((visit) => {
    if (!path.includes(visit.path)) {
      path.push(visit.path);
      return visit;
    }
  });

  let loadCustomVisits = filterVisits.map(async (filterVisit) => {
    let data = await Pageview.aggregate(
      [ 
        { $match: { path: filterVisit.path } },
        { $group: { _id: "$path", count: { $sum: 1 } } },
      ],  (error, result) => {
        if (error) { return error }
        return result;
      }
    );
    return data;
  });

  await Promise.all(loadCustomVisits).then(visits => {
    analyticsData = visits.map(visit => {
      let [ obj ] = visit;
      return obj;
    });
  }).catch(error => {
    console.log(error);
  });

  let orderData = analyticsData.sort( (a, b) => { return b.count - a.count } );
  res.render("analytics", { paths: orderData });
});

app.get("/notes/new", registerView, async (req, res) => {
  const notes = await Note.find();
  res.render("new", { notes: notes });
});

app.post("/notes", async (req, res, next) => {
  const data = {
    title: req.body.title,
    body: req.body.body,
  };

  const note = new Note(req.body);
  try {
    await note.save();
  } catch (e) {
    return next(e);
  }

  res.redirect("/");
});

app.get("/notes/:id", registerView, async (req, res) => {
  const notes = await Note.find();
  const note = await Note.findById(req.params.id);
  res.render("show", { notes: notes, currentNote: note, md: md });
});

app.get("/notes/:id/edit", registerView, async (req, res, next) => {
  const notes = await Note.find();
  const note = await Note.findById(req.params.id);
  res.render("edit", { notes: notes, currentNote: note });
});

app.patch("/notes/:id", async (req, res) => {
  const id = req.params.id;
  const note = await Note.findById(id);

  note.title = req.body.title;
  note.body = req.body.body;

  try {
    await note.save();
  } catch (e) {
    return next(e);
  }

  res.status(204).send({});
});

app.delete("/notes/:id", async (req, res) => {
  await Note.deleteOne({ _id: req.params.id });
  res.status(204).send({});
});

app.listen(3000, () => console.log("Listening on port 3000 ..."));
