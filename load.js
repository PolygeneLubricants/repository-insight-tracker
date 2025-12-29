const core = require("@actions/core");
const github = require("@actions/github");
const path = require("path");
const { Base64 } = require("js-base64");

async function run() {
  try {
    const token = core.getInput("github-token");
    const octokit = github.getOctokit(token);
    const owner = core.getInput("owner");
    const repo = core.getInput("repository");
    const branch = core.getInput("branch");

    const { stargazerCount, commitCount, contributorsCount } =
      await getRepoStats(octokit, owner, repo);

    await ensureBranchExists({ octokit, branch });

    let [insightsFile, insightsCount] = await getInsightsFile({
      octokit,
      branch,
    });

    // Check if the insights file is empty or has less than 14 entries
    if (insightsCount < 14) {
      console.log("Insights file is empty or has less than 14 entries.");
      console.log(
        "Ensuring the previous 14 days of data are present in the insights file."
      );

      let i = 14;
      while (i != 1) {
        // Capture the previous 13 days of data
        const today = new Date();
        today.setDate(today.getDate() - i);
        let yesterdayDateString = today.toISOString().split("T")[0];

        let [yesterdayTraffic, yesterdayClones] = await Promise.all([
          getYesterdayTraffic(octokit, owner, repo, yesterdayDateString),
          getYesterdayClones(octokit, owner, repo, yesterdayDateString),
        ]);

        insightsFile = await generateFileContent({
          insightsFile,
          stargazerCount,
          commitCount,
          contributorsCount,
          yesterdayTraffic,
          yesterdayClones,
          yesterdayDateString,
        });

        i--;
      }
    }

    // Normal workflow only capturing the previous day's data
    const yesterdayDateString = getYesterdayDateString();

    const [yesterdayTraffic, yesterdayClones] = await Promise.all([
      getYesterdayTraffic(octokit, owner, repo, yesterdayDateString),
      getYesterdayClones(octokit, owner, repo, yesterdayDateString),
    ]);

    logResults({
      stargazerCount,
      commitCount,
      contributorsCount,
      yesterdayTraffic,
      yesterdayClones,
    });

    setOutputs({
      stargazerCount,
      commitCount,
      contributorsCount,
      yesterdayTraffic,
      yesterdayClones,
    });

    const fileContent = await generateFileContent({
      insightsFile,
      stargazerCount,
      commitCount,
      contributorsCount,
      yesterdayTraffic,
      yesterdayClones,
      yesterdayDateString,
    });
    // console.log("File Content:", fileContent);

    await commitFileToBranch({
      octokit,
      branch,
      fileContent,
    });
  } catch (error) {
    console.log(error);
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

function getYesterdayDateString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

async function getYesterdayTraffic(octokit, owner, repo, dateString) {
  const { data: viewsData } = await octokit.rest.repos.getViews({
    owner,
    repo,
    per: "day",
  });
  return (
    viewsData.views.find(
      (view) => view.timestamp.split("T")[0] === dateString
    ) || { count: 0, uniques: 0 }
  );
}

async function getYesterdayClones(octokit, owner, repo, dateString) {
  const { data: clonesData } = await octokit.rest.repos.getClones({
    owner,
    repo,
    per: "day",
  });
  return (
    clonesData.clones.find(
      (clone) => clone.timestamp.split("T")[0] === dateString
    ) || { count: 0, uniques: 0 }
  );
}

async function getRepoStats(octokit, owner, repo) {
  const query = `
    {
      repository(owner: "${owner}", name: "${repo}") {
        stargazerCount
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100) {
                totalCount
                nodes {
                  author {
                    user {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;

  const response = await octokit.graphql(query);

  const stargazerCount = response.repository.stargazerCount;
  const commitCount =
    response.repository.defaultBranchRef.target.history.totalCount;

  const contributorsSet = new Set(
    response.repository.defaultBranchRef.target.history.nodes
      .filter((node) => node.author.user)
      .map((node) => node.author.user.login)
  );

  return {
    stargazerCount,
    commitCount,
    contributorsCount: contributorsSet.size,
  };
}

function logResults({
  stargazerCount,
  commitCount,
  contributorsCount,
  yesterdayTraffic,
  yesterdayClones,
}) {
  console.log(`Total Stargazers: ${stargazerCount}`);
  console.log(`Total Commits: ${commitCount}`);
  console.log(`Total Contributors: ${contributorsCount}`);
  console.log(`Total Views Yesterday: ${yesterdayTraffic.count}`);
  console.log(`Total Unique Views Yesterday: ${yesterdayTraffic.uniques}`);
  console.log(`Total Clones Yesterday: ${yesterdayClones.count}`);
  console.log(`Total Unique Clones Yesterday: ${yesterdayClones.uniques}`);
}

function setOutputs({
  stargazerCount,
  commitCount,
  contributorsCount,
  yesterdayTraffic,
  yesterdayClones,
}) {
  core.setOutput("stargazers", stargazerCount);
  core.setOutput("commits", commitCount);
  core.setOutput("contributors", contributorsCount);
  core.setOutput("traffic_views", yesterdayTraffic.count);
  core.setOutput("traffic_uniques", yesterdayTraffic.uniques);
  core.setOutput("clones_count", yesterdayClones.count);
  core.setOutput("clones_uniques", yesterdayClones.uniques);
}

async function getInsightsFile({ octokit, branch }) {
  let format = core.getInput("format") || "json"; // 'json' or 'csv'
  format = format.toLowerCase();
  const rootDir = core.getInput("directory");
  const file_path_owner = core.getInput("owner");
  const file_path_repo = core.getInput("repository");
  const { owner, repo } = github.context.repo;
  const dirPath = path.join(rootDir, file_path_owner, file_path_repo);
  const filePath = path.join(dirPath, `stats.${format}`);

  let insightsFile, insightsCount;

  try {
    // Check if the file exists in the repository
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    const existingContent = Base64.decode(fileData.content);

    if (format === "json") {
      insightsFile = existingContent;
      insightsCount = JSON.parse(existingContent).length;
    } else if (format === "csv") {
      const csvLines = existingContent
        .split("\n")
        .filter((line) => line.trim() !== "");
      insightsFile = csvLines.join("\n");
      insightsCount = csvLines.length - 1; // Subtract header line
    } else {
      throw new Error(
        'Unsupported format. Please choose either "json" or "csv".'
      );
    }
  } catch (error) {
    // If file doesn't exist, create an empty file
    console.log(error);
    console.log("Error finding file. Creating a new file.");
    if (format === "json") {
      insightsFile = JSON.stringify([], null, 2);
    } else if (format === "csv") {
      const csvHeaders = [
        "date",
        "stargazers",
        "commits",
        "contributors",
        "traffic_views",
        "traffic_uniques",
        "clones_count",
        "clones_uniques",
      ];
      insightsFile = `${csvHeaders.join(",")}\n`;
    } else {
      throw new Error(
        'Unsupported format. Please choose either "json" or "csv".'
      );
    }
    insightsCount = 0;
  }
  return [insightsFile, insightsCount];
}

async function generateFileContent({
  insightsFile,
  stargazerCount,
  commitCount,
  contributorsCount,
  yesterdayTraffic,
  yesterdayClones,
  yesterdayDateString,
}) {
  let format = core.getInput("format") || "json"; // 'json' or 'csv'
  format = format.toLowerCase();

  const newEntry = {
    date: yesterdayDateString,
    stargazers: stargazerCount,
    commits: commitCount,
    contributors: contributorsCount,
    traffic_views: yesterdayTraffic.count,
    traffic_uniques: yesterdayTraffic.uniques,
    clones_count: yesterdayClones.count,
    clones_uniques: yesterdayClones.uniques,
  };

  let fileContent;

  try {
    if (format === "json") {
      let existingData = JSON.parse(insightsFile);

      // Check if an entry for today already exists
      const existingEntryIndex = existingData.findIndex(
        (entry) => entry.date === newEntry.date
      );

      if (existingEntryIndex !== -1) {
        // Update the existing entry
        existingData[existingEntryIndex] = newEntry;
      } else {
        // Add the new entry
        existingData.push(newEntry);
      }

      fileContent = JSON.stringify(existingData, null, 2);
    } else if (format === "csv") {
      const csvHeaders = [
        "date",
        "stargazers",
        "commits",
        "contributors",
        "traffic_views",
        "traffic_uniques",
        "clones_count",
        "clones_uniques",
      ];
      const csvLines = insightsFile
        .split("\n")
        .filter((line) => line.trim() !== "");

      // Check if an entry for today already exists
      const existingEntryIndex = csvLines.findIndex((line) =>
        line.startsWith(newEntry.date)
      );

      const csvLine = csvHeaders.map((header) => newEntry[header]).join(",");

      if (existingEntryIndex !== -1) {
        // Update the existing entry
        csvLines[existingEntryIndex] = csvLine;
      } else {
        // Add the new entry
        csvLines.push(csvLine);
      }

      fileContent = csvLines.join("\n");
    }
  } catch (error) {
    throw new Error(`Unable to generate file content: ${error.message}`);
  }
  return fileContent;
}

async function ensureBranchExists({ octokit, branch }) {
  const { owner, repo } = github.context.repo;

  try {
    // Check if the branch exists
    await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    // Branch exists, no action needed
  } catch (error) {
    if (error.status === 404) {
      // Branch does not exist, create it
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: "heads/main", // Base branch from which to create the new branch
      });

      const mainSha = refData.object.sha;

      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: mainSha,
      });

      console.log(`Branch '${branch}' created from 'main'.`);
    } else {
      throw new Error(`Error checking if branch exists: ${error.message}`);
    }
  }
}

async function commitFileToBranch({ octokit, branch, fileContent }) {
  let format = core.getInput("format") || "json"; // 'json' or 'csv'
  format = format.toLowerCase();
  const rootDir = core.getInput("directory") || "./data";
  const { owner, repo } = github.context.repo;
  const file_path_owner = core.getInput("owner");
  const file_path_repo = core.getInput("repository");
  const dirPath = path.join(rootDir, file_path_owner, file_path_repo);
  const filePath = path.join(dirPath, `stats.${format}`);

  // Get the SHA of the branch reference
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitSha = refData.object.sha;

  // Get the tree associated with the latest commit
  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  const treeSha = commitData.tree.sha;

  // Create a new blob with the file content
  const { data: blobData } = await octokit.rest.git.createBlob({
    owner,
    repo,
    content: fileContent,
    encoding: "utf-8",
  });

  // Create a new tree that adds the new file
  const { data: newTreeData } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: treeSha,
    tree: [
      {
        path: filePath,
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      },
    ],
  });

  // Create a new commit
  const { data: newCommitData } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `Update stats file for ${file_path_owner}/${file_path_repo}`,
    tree: newTreeData.sha,
    parents: [commitSha],
  });

  // Update the branch reference to point to the new commit
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommitData.sha,
  });
}

module.exports = {
  run,
};
