import React, { Suspense, lazy } from 'react'

import type { Props } from './types'

import { ShimmerEffect } from '../ShimmerEffect'

const DatePicker = lazy(() => import('./DatePicker'))

const DatePickerField: React.FC<Props> = (props) => (
  <Suspense fallback={<ShimmerEffect height={50} />}>
    <DatePicker {...props} />
  </Suspense>
)

export default DatePickerField
