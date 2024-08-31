# Github Action: Repository Insight Tracker

This GitHub Action updates the repository statistics including the number of stargazers, commits, contributors, traffic views, and clones. 
The results are stored in a JSON or CSV file and committed to a specified branch in the repository.

1. Collects statistics on stargazers, commits, contributors, traffic views, and clones using the Github Rest API and GraphQL API.
2. Writes the statistics to a JSON or CSV file under `<directory>/<owner>/<repository>/stats.<format>`.
3. Commits the file to a specified branch in the repository.
4. Pipes the data as output to the next action, for further processing.

## Inputs

| Input Name    | Description                                                      | Required | Default                       |
| ------------- | ---------------------------------------------------------------- | -------- | ----------------------------- |
| `github-token`| GitHub token to authenticate the action.                         | Yes      | `${{ secrets.GITHUB_TOKEN }}` |
| `owner`       | The organization or owner of the repository to get insights for. | No       | `${{ github.owner }}`         |
| `repository`  | The repository to get insights for.                              | No       | `${{ github.repository }}`    |
| `branch`      | The branch where the stats file will be committed.               | No       | `repository-insights`         |
| `directory`    | The root directory where the stats file will be stored.         | No       | `./.insights`                |
| `format`      | The format of the stats file. Options are `json` or `csv`.       | No       | `csv`                         |

## Outputs

| Output Name        | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `stargazers`       | The total number of stargazers for the repository.           |
| `commits`          | The total number of commits in the default branch.           |
| `contributors`     | The total number of unique contributors to the repository.   |
| `traffic_views`    | The total number of views from yesterday.                    |
| `traffic_uniques`  | The total number of unique visitors from yesterday.          |
| `clones_count`     | The total number of clones from yesterday.                   |
| `clones_uniques`   | The total number of unique cloners from yesterday.           |

## How to use?

To use this action in your repository, create a workflow file (e.g., `.github/workflows/update-stats.yml`) with the contents below.

This is the minimum configurable parameters to run the job, 
and will collect insights daily, on the repository that the workflow sits in, 
and store these as a CSV file, on the branch repository-insights, in directory `/.insights/<owner>/<repository>/stats.csv`.

```yaml
name: Collect repository insights

on:
  schedule:
    - cron: '0 0 * * *' # Runs daily at midnight
  workflow_dispatch:

jobs:
  update-stats:
    runs-on: ubuntu-latest
    steps:
      - name: Collect insights
        uses: polygenelubricants/repository-insight-tracker@v1.0
        with:
          github-token: ${{ secrets.TOKEN }}
```

## How to contribute?

* Clone the repository or download the files.
* Make your changes to the action's code in `index.js`.
* Pack changes with the following commands:
  * `npm i -g @vercel/ncc`
  * `ncc build load.js --license licenses.txt`
* The packaged index.js can be found under `dist/index.js`.
* Open a PR in `polygenelubricants/repository-insight-tracker`.