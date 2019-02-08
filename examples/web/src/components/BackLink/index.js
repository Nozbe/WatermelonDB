import React from 'react'
import { Link } from 'react-router-dom'

import style from './style'

const BackLink = ({to, onClick, children}) => (
    <Link className={style.backLink} to={to} onClick={onClick}>{children}</Link>
)

export default BackLink
