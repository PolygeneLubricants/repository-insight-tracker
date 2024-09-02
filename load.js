const core = require('@actions/core');
const github = require('@actions/github');
const path = require('path');
const { Base64 } = require('js-base64');

async function run() {
    try {
        const token = core.getInput('github-token');
        const octokit = github.getOctokit(token);
        const owner = core.getInput('owner');
        const repo = core.getInput('repository');
        const branch = core.getInput('branch');

        const yesterdayDateString = getYesterdayDateString();

        const [yesterdayTraffic, yesterdayClones] = await Promise.all([
            getYesterdayTraffic(octokit, owner, repo, yesterdayDateString),
            getYesterdayClones(octokit, owner, repo, yesterdayDateString),
        ]);

        const { stargazerCount, commitCount, contributorsCount } = await getRepoStats(octokit, owner, repo);

        logResults({ stargazerCount, commitCount, contributorsCount, yesterdayTraffic, yesterdayClones });

        setOutputs({ stargazerCount, commitCount, contributorsCount, yesterdayTraffic, yesterdayClones });

        const fileContent = await generateFileContent({
            octokit,
            branch,
            stargazerCount,
            commitCount,
            contributorsCount,
            yesterdayTraffic,
            yesterdayClones
        });

        await ensureBranchExists({ octokit, branch });
        
        await commitFileToBranch({
            octokit,
            branch,
            fileContent
        });
    } catch (error) {
        console.log(error);
        core.setFailed(`Action failed with error: ${error.message}`);
    }
}

function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

async function getYesterdayTraffic(octokit, owner, repo, dateString) {
    const { data: viewsData } = await octokit.rest.repos.getViews({
        owner,
        repo,
        per: 'day'
    });
    return viewsData.views.find(view => view.timestamp.split('T')[0] === dateString) || { count: 0, uniques: 0 };
}

async function getYesterdayClones(octokit, owner, repo, dateString) {
    const { data: clonesData } = await octokit.rest.repos.getClones({
        owner,
        repo,
        per: 'day'
    });
    return clonesData.clones.find(clone => clone.timestamp.split('T')[0] === dateString) || { count: 0, uniques: 0 };
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
    const commitCount = response.repository.defaultBranchRef.target.history.totalCount;

    const contributorsSet = new Set(
        response.repository.defaultBranchRef.target.history.nodes
            .filter(node => node.author.user)
            .map(node => node.author.user.login)
    );

    return {
        stargazerCount,
        commitCount,
        contributorsCount: contributorsSet.size
    };
}

function logResults({ stargazerCount, commitCount, contributorsCount, yesterdayTraffic, yesterdayClones }) {
    console.log(`Total Stargazers: ${stargazerCount}`);
    console.log(`Total Commits: ${commitCount}`);
    console.log(`Total Contributors: ${contributorsCount}`);
    console.log(`Total Views Yesterday: ${yesterdayTraffic.count}`);
    console.log(`Total Unique Views Yesterday: ${yesterdayTraffic.uniques}`);
    console.log(`Total Clones Yesterday: ${yesterdayClones.count}`);
    console.log(`Total Unique Clones Yesterday: ${yesterdayClones.uniques}`);
}

function setOutputs({ stargazerCount, commitCount, contributorsCount, yesterdayTraffic, yesterdayClones }) {
    core.setOutput('stargazers', stargazerCount);
    core.setOutput('commits', commitCount);
    core.setOutput('contributors', contributorsCount);
    core.setOutput('traffic_views', yesterdayTraffic.count);
    core.setOutput('traffic_uniques', yesterdayTraffic.uniques);
    core.setOutput('clones_count', yesterdayClones.count);
    core.setOutput('clones_uniques', yesterdayClones.uniques);
}

async function generateFileContent({ octokit, branch, stargazerCount, commitCount, contributorsCount, yesterdayTraffic, yesterdayClones }) {
    const rootDir = core.getInput('directory');
    let format = core.getInput('format'); // 'json' or 'csv'
    format = format.toLowerCase();
    const file_path_owner = core.getInput('owner');
    const file_path_repo = core.getInput('repository');
    const { owner, repo } = github.context.repo;
    const dirPath = path.join(rootDir, file_path_owner, file_path_repo);
    const filePath = path.join(dirPath, `stats.${format}`);

    const newEntry = {
        date: getYesterdayDateString(),
        stargazers: stargazerCount,
        commits: commitCount,
        contributors: contributorsCount,
        traffic_views: yesterdayTraffic.count,
        traffic_uniques: yesterdayTraffic.uniques,
        clones_count: yesterdayClones.count,
        clones_uniques: yesterdayClones.uniques
    };

    let fileContent;

    try {
        // Check if the file exists in the repository
        const { data: fileData } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch
        });

        const existingContent = Base64.decode(fileData.content);

        if (format === 'json') {
            let existingData = JSON.parse(existingContent);

            // Check if an entry for today already exists
            const existingEntryIndex = existingData.findIndex(entry => entry.date === newEntry.date);

            if (existingEntryIndex !== -1) {
                // Update the existing entry
                existingData[existingEntryIndex] = newEntry;
            } else {
                // Add the new entry
                existingData.push(newEntry);
            }

            fileContent = JSON.stringify(existingData, null, 2);
        } else if (format === 'csv') {
            const csvHeaders = ['date', 'stargazers', 'commits', 'contributors', 'traffic_views', 'traffic_uniques', 'clones_count', 'clones_uniques'];
            const csvLines = existingContent.split('\n').filter(line => line.trim() !== '');

            // Check if an entry for today already exists
            const existingEntryIndex = csvLines.findIndex(line => line.startsWith(newEntry.date));

            const csvLine = csvHeaders.map(header => newEntry[header]).join(',');

            if (existingEntryIndex !== -1) {
                // Update the existing entry
                csvLines[existingEntryIndex] = csvLine;
            } else {
                // Add the new entry
                csvLines.push(csvLine);
            }

            fileContent = csvLines.join('\n');
        } else {
            throw new Error('Unsupported format. Please choose either "json" or "csv".');
        }
    } catch (error) {
        // If file doesn't exist, create new content
        console.log(error);
        console.log("Error finding file. Creating file.");
        if (format === 'json') {
            fileContent = JSON.stringify([newEntry], null, 2);
        } else if (format === 'csv') {
            const csvHeaders = ['date', 'stargazers', 'commits', 'contributors', 'traffic_views', 'traffic_uniques', 'clones_count', 'clones_uniques'];
            const csvLine = csvHeaders.map(header => newEntry[header]).join(',');
            fileContent = `${csvHeaders.join(',')}\n${csvLine}`;
        } else {
            throw new Error('Unsupported format. Please choose either "json" or "csv".');
        }
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
            ref: `heads/${branch}`
        });
        // Branch exists, no action needed
    } catch (error) {
        if (error.status === 404) {
            // Branch does not exist, create it
            const { data: refData } = await octokit.rest.git.getRef({
                owner,
                repo,
                ref: 'heads/main' // Base branch from which to create the new branch
            });

            const mainSha = refData.object.sha;

            await octokit.rest.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${branch}`,
                sha: mainSha
            });

            console.log(`Branch '${branch}' created from 'main'.`);
        } else {
            throw error;
        }
    }
}

async function commitFileToBranch({ octokit, branch, fileContent }) {
    const rootDir = core.getInput('directory') || './data';
    const format = core.getInput('format') || 'json';
    const { owner, repo } = github.context.repo;    
    const file_path_owner = core.getInput('owner');
    const file_path_repo = core.getInput('repository');
    const dirPath = path.join(rootDir, file_path_owner, file_path_repo);
    const filePath = path.join(dirPath, `stats.${format}`);

    // Get the SHA of the branch reference
    const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
    });

    const commitSha = refData.object.sha;

    // Get the tree associated with the latest commit
    const { data: commitData } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: commitSha
    });

    const treeSha = commitData.tree.sha;

    // Create a new blob with the file content
    const { data: blobData } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: fileContent,
        encoding: 'utf-8'
    });

    // Create a new tree that adds the new file
    const { data: newTreeData } = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: treeSha,
        tree: [{
            path: filePath,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
        }]
    });

    // Create a new commit
    const { data: newCommitData } = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: `Update stats file for ${file_path_owner}/${file_path_repo}`,
        tree: newTreeData.sha,
        parents: [commitSha]
    });

    // Update the branch reference to point to the new commit
    await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommitData.sha
    });
}

run();