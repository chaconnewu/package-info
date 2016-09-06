'use babel'

import { spawn } from 'child_process'
import moment from 'moment'
import request from 'request'
import url from 'url'
import LRUCache from 'lru-cache'
// import _ from 'lodash'
import { pick } from 'ramda'

import PackageInfoView from './package-info-view'
import { CompositeDisposable } from 'atom'

// Setup Cache
const cacheOptions = {
  max: 100,
  length: (n, key) => { n * 2 + key.length },
  maxAge: 1000 * 60 * 60
}

let cache = LRUCache(cacheOptions)

function run_cmd(cmd, args) {
  try {
    let child = spawn(cmd, args)
    let resp = ""

    child.stdout.on('data', (buffer) => {
      resp += buffer.toString()
    })

    return new Promise((resolve, reject) => {
      child.stdout.on('end', () => {
        resolve(JSON.parse(resp))
      })
    })
  } catch (e) {
    console.warn('Cannot run npm in your system. Skip npm info')
  }
}

async function getNPMViewInfo(packageName) {
  let repoInfo = await run_cmd("npm", ["v", "--json", packageName])
  let { description, repository: { url } } = repoInfo
  return { description, url }
}

async function getNPMRepoInfo(name) {
  let counts, description, url
  if (cache.get(name)) {
    ({ counts, description, url } = cache.get(name))
  } else {
    ([counts, {description, url}] = await Promise.all([downloadCount(name), getNPMViewInfo(name)]))
    cache.set(name, { counts, description, url })
  }
  return { name, counts, description, url }
}

function getGitHubRepoInfo(packageObj) {
  const { fullName, repoName } = packageObj
  const repoSearchString = `https://api.github.com/search/repositories?q=${packageObj.repoName}+fork:false+language:js+repo:${fullName}`

  return new Promise((resolve, reject) => {
    request({
      headers: {
        // Has to add 'User-Agent' header. Otherwise GitHub won't accept the request
        'User-Agent': 'Package Info Atom Plugin'
      },
      uri: repoSearchString
    }, function(error, response, body) {
      let resBody = JSON.parse(body)
      if (!error && response.statusCode == 200 && resBody.items.length > 0) {
        let resultItem = resBody.items[0]
        resolve(pick(resultItem, 'created_at', 'description', 'forks_count', 'html_url', 'stargazers_count'))
      } else {
        reject({
          reason: 'Unable to download GitHub info'
        })
      }
    })
  })
}

function getCount(urlItem) {
  let { period, packageUrl } = urlItem
  return new Promise((resolve, reject) => {request(packageUrl, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        resolve({
          period,
          downloads: JSON.parse(body).downloads
        })
      } else {
        reject({
          reason: 'Unable to download NPM count info'
        })
      }
    })
  })
}

async function downloadCount(package) {
  const downloadPrefix = 'https://api.npmjs.org/downloads/point/'
  let datesArr = []

  let current = new moment()
  let currentMonthRange = getMonthDateRange(current.format('YYYY-MM'))
  let currentMonth = current.format('YYYY-MM')
  let previousMonth = moment(currentMonth).subtract(1, 'months').format('YYYY-MM')
  datesArr.push(currentMonth)
  for (let i = 1; i < 12; i++) {
    currentMonth = previousMonth
    datesArr.push(currentMonth)
    previousMonth = moment(currentMonth).subtract(1, 'months').format('YYYY-MM')
  }

  datesArr.reverse()

  let urlArr = datesArr.map((aDate) => {
    let period = getMonthDateRange(aDate)
    return {
      period,
      packageUrl: downloadPrefix + period.start + ':' + period.end + '/' + package
    }
  })

  let res = await Promise.all(urlArr.map((urlItem) => {
    return getCount(urlItem)
  }))

  return res
}

function getMonthDateRange(aDate) {
  const start = moment(aDate).format('YYYY-MM-DD')
  const end = moment(start).endOf('month').format('YYYY-MM-DD')
  return { start, end }
}

function extractGitHubRepoName(repoUrl) {
  let [, user, repo] = url.parse(repoUrl).path.split('/')
  let [repoName, ] = repo.split('.')
  return {
    fullName: user + '/' + repoName,
    repoName
  }
}

async function submitQuery(query) {
  const separators = [' ', '\n', '\\\+', '\\\(', '\\\)', '\\*', '/', ':', '\\\?']
  const packageNames = query.split(new RegExp(separators.join('|'), 'g')).filter(item => item.length)
  const npmResults = await Promise.all(
    packageNames.map((packageName) => {
      return getNPMRepoInfo(packageName)
    })
  )
  return npmResults
}

export default {

  packageInfoView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.packageInfoView = new PackageInfoView(state.packageInfoViewState)
    this.modalPanel = atom.workspace.addRightPanel({
      item: this.packageInfoView.getElement(),
      visible: false
    })

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable()

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'package-info:get': () => this.showPackageInfo(),
      'package-info:update': () => this.updatePackageInfo()
    }))
  },

  deactivate() {
    this.modalPanel.destroy()
    this.subscriptions.dispose()
    this.packageInfoView.destroy()
  },

  async updatePackageInfo() {
    let editor

    if (editor = atom.workspace.getActiveTextEditor()) {
      let query = editor.getSelectedText()

      if (!query) {
        return
      }

      const packagesInfo = await submitQuery(query)
      this.packageInfoView.showPanel({ packagesInfo })
    }
  },

  async showPackageInfo() {
    let editor
    let self = this

    self.toggle()

    if (!this.modalPanel.isVisible()) {
      // If panel is closed, simply return
      // ** !this.modalPanel.isVisible() means it is closed
      return
    }

    if (editor = atom.workspace.getActiveTextEditor()) {
      let query = editor.getSelectedText()

      if (!query) {
        return
      }

      const packagesInfo = await submitQuery(query)
      this.packageInfoView.showPanel({ packagesInfo })
      //
      // let npmPackageInfo = await getNPMRepoInfo(query)
      // let githubPackageInfo = await getGitHubRepoInfo(extractGitHubRepoName(npmPackageInfo.url))
    }
  },

  toggle() {

   return (
     this.modalPanel.isVisible() ?
     this.modalPanel.hide() :
     this.modalPanel.show()
   )
  }

}
