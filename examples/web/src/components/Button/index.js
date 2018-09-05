import React from 'react'

import style from './style'

const Button = ({ title, onClick }) => (
  <button className={style.root} onClick={onClick}>
    {title}
  </button>
)

export default Button
