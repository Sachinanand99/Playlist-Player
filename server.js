const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const ffmpeg = require("fluent-ffmpeg");
const pdfParse = require("pdf-parse");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

let cachedTree = null;
const watchers = [];

function watchCourseFolder(rootPath) {
  watchers.forEach((w) => w.close());
  watchers.length = 0;

  const rootWatcher = fsWatch(rootPath, () => {
    cachedTree = null;
  });
  watchers.push(rootWatcher);

  fs.readdir(rootPath)
    .then((entries) => {
      entries.forEach((entry) => {
        const entryPath = path.join(rootPath, entry);
        fs.stat(entryPath)
          .then((stat) => {
            if (stat.isDirectory()) {
              const watcher = fsWatch(entryPath, () => {
                cachedTree = null;
              });
              watchers.push(watcher);
            }
          })
          .catch(() => {});
      });
    })
    .catch(() => {});
}

function fsWatch(dir, onChange) {
  try {
    return require("fs").watch(
      dir,
      { persistent: true },
      (eventType, filename) => {
        console.log(`📁 Change detected in ${dir}: ${eventType} ${filename}`);
        onChange();
      }
    );
  } catch (err) {
    console.error(`❌ Failed to watch ${dir}:`, err);
    return { close: () => {} };
  }
}

function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata.format?.duration) return resolve(null);
      resolve(`${Math.floor(metadata.format.duration)}s`);
    });
  });
}

async function getPdfPageCount(filePath) {
  try {
    const data = await fs.readFile(filePath);
    const pdf = await pdfParse(data);
    return `${pdf.numpages} pages`;
  } catch {
    return null;
  }
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function getCourseTree(rootPath) {
  async function scan(dir, prefix = []) {
    const entries = await fs.readdir(dir);
    const modules = [];

    for (const entry of entries.sort()) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        const submodules = await scan(fullPath, [...prefix, entry]);
        modules.push(...submodules);
      } else {
        const ext = path.extname(entry).toLowerCase();
        let type = "other";
        if ([".mp4", ".mkv", ".mov", ".webm"].includes(ext)) type = "video";
        else if (ext === ".pdf") type = "pdf";
        else if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) type = "image";

        let meta = null;
        if (type === "video") meta = await getVideoDuration(fullPath);
        else if (type === "pdf") meta = await getPdfPageCount(fullPath);

        const modulePath = prefix.join(" / ");
        const mod = modules.find(m => m.fullPath === modulePath);
        const file = {
          name: entry,
          type,
          path: `/file/${encodeURIComponent(prefix.join("/"))}/${encodeURIComponent(entry)}`,
          meta
        };

        if (mod) mod.files.push(file);
        else modules.push({ name: prefix[prefix.length - 1], fullPath: modulePath, depth: prefix.length, files: [file] });
      }
    }

    return modules;
  }

  return await scan(rootPath);
}

app.get("/file/*", (req, res) => {
  const root = req.cookies.root;
  if (!root) return res.status(400).send("Root folder not set.");
  const filePath = path.join(root, ...req.params[0].split("/"));
  res.sendFile(filePath);
});

app.get("/set-root", (req, res) => {
  res.render("set-root");
});

app.post("/set-root", async (req, res) => {
  const rootPath = req.body.root;
  try {
    const stat = await fs.stat(rootPath);
    if (!stat.isDirectory()) throw new Error("Not a directory");
    res.cookie("root", rootPath, { httpOnly: true });
    cachedTree = null;
    watchCourseFolder(rootPath);
    res.redirect("/");
  } catch {
    res.send("❌ Invalid folder path. Please try again.");
  }
});

app.get("/", async (req, res) => {
  const root = req.cookies.root;
  if (!root) return res.redirect("/set-root");

  const tree = await getCourseTree(root);
  const flatList = [];

  function flatten(node) {
    if (node.type === "folder") {
      node.children.forEach(flatten);
    } else {
      flatList.push({
        module: node.fullPath.split(" / ").slice(0, -1).join(" / "),
        name: node.name,
        path: node.path,
        type: node.type,
      });
    }
  }

  tree.forEach(flatten);

  let { m: selectedModule, f: selectedFile } = req.query;

  if (!selectedModule || !selectedFile) {
    selectedModule = req.cookies.lastViewedModule;
    selectedFile = req.cookies.lastViewedFile;

    if (!selectedModule || (!selectedFile && flatList.length > 0)) {
      selectedModule = flatList[0].module;
      selectedFile = flatList[0].name;
    }

    return res.redirect(
      `/?m=${encodeURIComponent(selectedModule)}&f=${encodeURIComponent(
        selectedFile
      )}`
    );
  }

  const selected = flatList.find(
    (f) => f.module === selectedModule && f.name === selectedFile
  );

res.render("index", {
  modules: tree,
  selected,
  flatList,
  cookies: req.cookies,
});
});

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
