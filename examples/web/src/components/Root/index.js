import React, { Component } from 'react'
import { BrowserRouter as Router, Route, Switch, Link } from 'react-router-dom'
import { generate100, generate10k } from 'models/generate'

import Button from 'components/Button'
import BlogList from 'components/BlogList'
import Post from 'components/Post'
import Blog from 'components/Blog'
import ModerationQueue from 'components/ModerationQueue'
import BackLink from 'components/BackLink'
import logoSrc from './WatermelonLogo.svg'

import style from './style'

class Root extends Component {
  state = {
    search: '',
    isShowPostList: false,
    isShowMain: false,
  }

  generateWith = async generator => {
    this.setState({
      search: '',
      isShowPostList: false,
      isShowMain: false,
    })

    const count = await generator(this.props.database)

    alert(`Generated ${count} records!`)
  }

  generate100 = () => this.generateWith(generate100)

  generate10k = () => this.generateWith(generate10k)

  handleTextChange = e => {
    this.setState({ search: e.target.value })
  }

  showPostList = () => this.setState({isShowPostList: true});

  hidePostList = () => this.setState({isShowPostList: false});

  showMain = () => this.setState({isShowMain: true});

  hideMain = () => this.setState({isShowMain: false});

  render() {
    const { database } = this.props
    const { search, isShowPostList, isShowMain } = this.state

    return (
      <Router basename="/">
        <div className={style.root}>
          <div className={style.header}>
            <img src={logoSrc} alt="WatermelonDB Logo" className={style.logo} />
          </div>
          <div className={style.headerBtnGroup}>
            <Button title={<Link className={style.generateLink} to="/blog">Generate 100 records</Link>}
              onClick={this.generate100}
            />
            <Button title={<Link className={style.generateLink} to="/blog">Generate 10,000 records</Link>}
              onClick={this.generate10k}
            />
          </div>

          <div className={style.content}>
            <div className={style.sidebar}>
              <input className={style.searchInput}
                placeholder="Search ..."
                type="text"
                defaultValue=""
                onChange={this.handleTextChange} />
              <BlogList search={search} database={database} showPostList={this.showPostList} />
            </div>

              <Route path="/blog/:blogId"
                render={props =>
                  (isShowPostList || props.match.params.blogId) && (
                      <div className={style.postList}>
                        <BackLink to="/blog" onClick={this.hidePostList}>&lt; Back</BackLink>
                        <Blog key={props.match.params.blogId} database={database} {...props} showMain={this.showMain} />
                      </div>
                  )
                }
              />


            <div className={style.wrapper}>
              <Switch>
                  <React.Fragment>
                    <Route path="/blog/:blogId/nasty"
                      render={props => (isShowMain || props.match.params.blogId) && (
                        <div className={style.main}>
                          <ModerationQueue database={database} hideMain={this.hideMain} {...props} />
                        </div>
                      )}
                    />
                    <Route path="/blog/:blogId/post/:postId"
                      render={props => (isShowMain || props.match.params.postId) && (
                        <div className={style.main}>
                          <Post database={database} hideMain={this.hideMain} {...props} />
                        </div>
                      )}
                    />
                  </React.Fragment>
              </Switch>
            </div>
          </div>
        </div>
      </Router>
    )
  }
}

export default Root
