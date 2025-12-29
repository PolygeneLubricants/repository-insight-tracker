const core = require('@actions/core');
const github = require('@actions/github');

jest.mock('@actions/core');
jest.mock('@actions/github');

const { run } = require('../load');

describe('Update Repository Stats Action', () => {
    let octokit;

    beforeEach(() => {
        jest.resetModules(); // Clear cache between tests
        process.env.GITHUB_WORKSPACE = __dirname; // Set a mock workspace

        // Mock the octokit instance
        octokit = {
            rest: {
                repos: {
                    getViews: jest.fn(),
                    getClones: jest.fn(),
                    getContent: jest.fn(),  // Mock getContent
                },
                git: {
                    getRef: jest.fn(),
                    getCommit: jest.fn(),
                    createBlob: jest.fn(),
                    createTree: jest.fn(),
                    createCommit: jest.fn(),
                    updateRef: jest.fn(),
                },
            },
            graphql: jest.fn(), // Mock the graphql method
        };

        github.getOctokit.mockReturnValue(octokit); // Return the mocked octokit

        // Mock github.context.repo to avoid undefined errors
        github.context.repo = {
            owner: 'fake-owner',
            repo: 'fake-repo',
        };

        // Mock github.context.ref and other necessary parts of the context if needed
        github.context.ref = 'refs/heads/main';

        // Mock core.getInput to return specific values based on the input name
        core.getInput = jest.fn((key) => {
            switch (key) {
                case 'github-token':
                    return 'fake-token';
                case 'owner':
                    return 'fake-owner';
                case 'repository':
                    return 'fake-repo';
                case 'branch':
                    return 'main';
                case 'directory':
                    return './data';
                case 'format':
                    return 'json';
                default:
                    return '';
            }
        });

        // Mock the repos.getContent response
        octokit.rest.repos.getContent.mockResolvedValue({
            data: {
                type: 'file',
                encoding: 'base64',
                content: Buffer.from(JSON.stringify([
                    {
                        date: '2024-08-19',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-20',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-21',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-22',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-23',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-24',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-25',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-26',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-27',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-28',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-29',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-30',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-08-31',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    },
                    {
                        date: '2024-09-01',
                        stargazers: 5,
                        commits: 15,
                        contributors: 2,
                        traffic_views: 50,
                        traffic_uniques: 10,
                        clones_count: 7,
                        clones_uniques: 3
                    }
                ])).toString('base64'),
                sha: 'fake-file-sha'
            }
        });

        // Mock the Date constructor to return a fixed date
        const mockDate = new Date('2024-09-02T00:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks(); // Restore Date to its original state
    });

    it('should fetch repository statistics and commit to the correct branch', async () => {
        // Mock the API responses
        octokit.rest.repos.getViews.mockResolvedValue({
            data: { views: [{ timestamp: '2024-09-01T00:00:00Z', count: 84, uniques: 1 }] },
        });

        octokit.rest.repos.getClones.mockResolvedValue({
            data: { clones: [{ timestamp: '2024-09-01T00:00:00Z', count: 10, uniques: 1 }] },
        });

        octokit.rest.git.getRef.mockResolvedValue({
            data: { object: { sha: 'fake-sha' } },
        });

        octokit.rest.git.getCommit.mockResolvedValue({
            data: { tree: { sha: 'fake-tree-sha' } },
        });

        octokit.rest.git.createBlob.mockResolvedValue({
            data: { sha: 'fake-blob-sha' },
        });

        octokit.rest.git.createTree.mockResolvedValue({
            data: { sha: 'fake-new-tree-sha' },
        });

        octokit.rest.git.createCommit.mockResolvedValue({
            data: { sha: 'fake-new-commit-sha' },
        });

        octokit.rest.git.updateRef.mockResolvedValue({});

        octokit.graphql.mockResolvedValue({
            repository: {
                stargazerCount: 10,
                defaultBranchRef: {
                    target: {
                        history: {
                            totalCount: 100,
                            nodes: [
                                {
                                    author: {
                                        user: {
                                            login: 'contributor1',
                                        },
                                    },
                                },
                                {
                                    author: {
                                        user: {
                                            login: 'contributor2',
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        });

        await run();

        expect(core.setOutput).toHaveBeenCalledWith('stargazers', 10);
        expect(core.setOutput).toHaveBeenCalledWith('commits', 100);
        expect(core.setOutput).toHaveBeenCalledWith('contributors', 2);
        expect(core.setOutput).toHaveBeenCalledWith('traffic_views', 84);
        expect(core.setOutput).toHaveBeenCalledWith('traffic_uniques', 1);
        expect(core.setOutput).toHaveBeenCalledWith('clones_count', 10);
        expect(core.setOutput).toHaveBeenCalledWith('clones_uniques', 1);
    });

    it('should handle empty repository statistics correctly', async () => {
        // Mock the API responses to return empty data
        octokit.rest.repos.getViews.mockResolvedValue({
            data: { views: [] }, // No views data
        });

        octokit.rest.repos.getClones.mockResolvedValue({
            data: { clones: [] }, // No clones data
        });

        octokit.rest.git.getRef.mockResolvedValue({
            data: { object: { sha: 'fake-sha' } },
        });

        octokit.rest.git.getCommit.mockResolvedValue({
            data: { tree: { sha: 'fake-tree-sha' } },
        });

        octokit.rest.git.createBlob.mockResolvedValue({
            data: { sha: 'fake-blob-sha' },
        });

        octokit.rest.git.createTree.mockResolvedValue({
            data: { sha: 'fake-new-tree-sha' },
        });

        octokit.rest.git.createCommit.mockResolvedValue({
            data: { sha: 'fake-new-commit-sha' },
        });

        octokit.rest.git.updateRef.mockResolvedValue({});

        octokit.graphql.mockResolvedValue({
            repository: {
                stargazerCount: 0, // No stargazers
                defaultBranchRef: {
                    target: {
                        history: {
                            totalCount: 0, // No commits
                            nodes: [], // No contributors
                        },
                    },
                },
            },
        });

        await run();

        // Verify that the outputs are set to the appropriate default values
        expect(core.setOutput).toHaveBeenCalledWith('stargazers', 0);
        expect(core.setOutput).toHaveBeenCalledWith('commits', 0);
        expect(core.setOutput).toHaveBeenCalledWith('contributors', 0);
        expect(core.setOutput).toHaveBeenCalledWith('traffic_views', 0);
        expect(core.setOutput).toHaveBeenCalledWith('traffic_uniques', 0);
        expect(core.setOutput).toHaveBeenCalledWith('clones_count', 0);
        expect(core.setOutput).toHaveBeenCalledWith('clones_uniques', 0);
    });
});