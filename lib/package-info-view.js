'use babel'

import React from 'react'
import ReactDOM from 'react-dom'
import { openExternal } from 'shell'
import { StyleSheet, css } from 'aphrodite'
import moment from 'moment'
import { Bar, Line } from 'react-chartjs-2'
import _ from 'lodash'
import Instructions from './components/instructions'

const colors = ['#727272', '#f1595f', '#79c36a', '#599ad3', '#f9a65a', '#9e66ab', '#cd7058', '#d77fb3']

const styles = StyleSheet.create({
  container: {
    width: 500,
  },
  header: {
    textAlign: 'center',
    fontSize: 24
  },
  vis: {
    boxSizing: 'border-box',
    padding: '0 15px 0 15px'
  },
  descriptionItem: {
    paddingLeft: 15,
    paddingRight: 15,
    fontSize: 14
  }
})

const Header = () => {
  return (
    <div className={css(styles.header)}>
      <span>Packages Infomation</span>
    </div>
  )
}

class Description extends React.Component {
  constructor(props) {
    super(props)
  }

  handleClick() {
    // Open project in external browser
    openExternal(this.props.url)
  }

  render() {
    const { name, description } = this.props
    return (
      <div className={css(styles.descriptionItem)}>
        <span><b onClick={this.handleClick.bind(this)}>{name}</b>: {description}</span>
      </div>
    )
  }
}

class InfoPanel extends React.Component {
  constructor(props) {
    super(props)
  }

  render() {
    let labels = []

    const barConfigData = this.props.packagesInfo.map(({counts, name}, index) => {
      let data = []
      counts.forEach(({period, downloads}) => {
        if (index === 0) {
          labels.push(moment(period.start).format('MMM\'YY'))
        }

        data.push(downloads)
      })
      return {
        label: name,
        backgroundColor: _.sample(colors),
        // backgroundColor: 'rgba(255,99,132,0.2)',
        // borderColor: 'rgba(255,99,132,1)',
        // borderWidth: 1,
        fill: false,
        lineTension: 0.1,
        hoverBackgroundColor: 'rgba(255,99,132,0.4)',
        hoverBorderColor: 'rgba(255,99,132,1)',
        data
      }
    })

    const barData = {
      labels,
      datasets: barConfigData
    }

    const descriptions = this.props.packagesInfo.map(({name, url, description}) => {
      return <Description
              name={name}
              url={url}
              description={description} />
    })
    return (
      <div className={css(styles.container)}>
        <Header />
        {descriptions}
        <div className={css(styles.vis)}>
          <Line
            data={barData}
            width={400}
            height={300}
            options={{
              maintainAspectRatio: true,
              title: {
                display: true,
                text: 'NPM downloads'
              }
            }}
          />

        </div>
        <Instructions />
      </div>
    )
  }
}

export default class PackageInfoView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div')
    this.element.id = 'package-info'
    this.element.classList.add('package-info')
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove()
  }

  getElement() {
    return this.element
  }

  showPanel(props) {
    ReactDOM.render(<InfoPanel {...props} />, this.element)
  }

}
