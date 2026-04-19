import express from "express";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

dotenv.config();

const execFileAsync = promisify(execFile);
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const runGit = async (cwd, args) => {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd,
    env: process.env
  });

  return { stdout: stdout.trim(), stderr: stderr.trim() };
};

const parseRepoInput = (repoInput) => {
  const clean = repoInput.trim().replace(/\.git$/, "").replace(/^https?:\/\/github\.com\//, "");

  if (!/^[^/]+\/[^/]+$/.test(clean)) {
    throw new Error("פורמט ריפו לא תקין. יש להשתמש ב-owner/repo או ב-URL מלא של GitHub.");
  }

  return clean;
};

const buildRemoteUrl = (repo, token) => {
  const encodedToken = encodeURIComponent(token);
  return `https://x-access-token:${encodedToken}@github.com/${repo}.git`;
};

const removeContents = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.name !== ".git")
      .map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        await fs.rm(fullPath, { recursive: true, force: true });
      })
  );
};

const copyRepoContents = async (from, to) => {
  const entries = await fs.readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".git") {
      continue;
    }

    await fs.cp(path.join(from, entry.name), path.join(to, entry.name), {
      recursive: true,
      force: true
    });
  }
};

app.post("/api/sync", async (req, res) => {
  const logs = [];

  try {
    const {
      sourceRepo,
      sourceBranch,
      targetRepo,
      targetBaseBranch,
      newBranch,
      githubToken,
      commitMessage
    } = req.body;

    if (!sourceRepo || !targetRepo || !newBranch) {
      return res.status(400).json({
        ok: false,
        error: "חובה להזין sourceRepo, targetRepo ו-newBranch"
      });
    }

    const token = (githubToken || process.env.GITHUB_TOKEN || "").trim();

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: "לא נמצא GitHub token. אפשר לשלוח בטופס או דרך משתנה סביבה GITHUB_TOKEN"
      });
    }

    const source = parseRepoInput(sourceRepo);
    const target = parseRepoInput(targetRepo);
    const srcBranch = (sourceBranch || "main").trim();
    const baseBranch = (targetBaseBranch || "main").trim();
    const branchName = newBranch.trim();

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-sync-"));
    const srcPath = path.join(tempRoot, "source");
    const targetPath = path.join(tempRoot, "target");

    try {
      logs.push(`Clone source: ${source} (${srcBranch})`);
      await runGit(tempRoot, ["clone", "--depth", "1", "--branch", srcBranch, buildRemoteUrl(source, token), srcPath]);

      logs.push(`Clone target: ${target} (${baseBranch})`);
      await runGit(tempRoot, ["clone", "--depth", "1", "--branch", baseBranch, buildRemoteUrl(target, token), targetPath]);

      logs.push(`Create new branch: ${branchName}`);
      await runGit(targetPath, ["checkout", "-b", branchName]);

      logs.push("Replace target files with source files");
      await removeContents(targetPath);
      await copyRepoContents(srcPath, targetPath);

      logs.push("Create commit");
      await runGit(targetPath, ["config", "user.name", process.env.GIT_AUTHOR_NAME || "repo-sync-bot"]);
      await runGit(targetPath, ["config", "user.email", process.env.GIT_AUTHOR_EMAIL || "repo-sync-bot@users.noreply.github.com"]);
      await runGit(targetPath, ["add", "-A"]);

      try {
        await runGit(targetPath, ["commit", "-m", (commitMessage || `Sync from ${source}@${srcBranch}`).trim()]);
      } catch (commitError) {
        if (`${commitError.stderr || ""}`.includes("nothing to commit")) {
          logs.push("No changes detected; skipping commit/push");
          return res.json({ ok: true, logs, branch: branchName, pushed: false });
        }
        throw commitError;
      }

      logs.push(`Push branch: ${branchName}`);
      await runGit(targetPath, ["push", "origin", branchName]);

      return res.json({ ok: true, logs, branch: branchName, pushed: true });
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  } catch (error) {
    logs.push(error.message);
    return res.status(500).json({
      ok: false,
      error: "הפעולה נכשלה",
      details: error.message,
      logs
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
