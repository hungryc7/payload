import React, { useEffect, useState } from 'react'

import type { SanitizedGlobalConfig } from '../../../../exports/types'

import { useStepNav } from '../../elements/StepNav'
import { useAuth } from '../../utilities/Auth'
import { useConfig } from '../../utilities/Config'
import RenderCustomComponent from '../../utilities/RenderCustomComponent'
import DefaultDashboard from './Default'

const Dashboard: React.FC = () => {
  const { permissions, user } = useAuth()
  const { setStepNav } = useStepNav()
  const [filteredGlobals, setFilteredGlobals] = useState<SanitizedGlobalConfig[]>([])

  const {
    admin: {
      components: {
        views: { Dashboard: CustomDashboard } = {
          Dashboard: undefined,
        },
      } = {},
    } = {},
    collections,
    globals,
  } = useConfig()

  useEffect(() => {
    setFilteredGlobals(
      globals.filter((global) => permissions?.globals?.[global.slug]?.read?.permission),
    )
  }, [permissions, globals])

  useEffect(() => {
    setStepNav([])
  }, [setStepNav])

  return (
    <RenderCustomComponent
      CustomComponent={CustomDashboard}
      DefaultComponent={DefaultDashboard}
      componentProps={{
        collections: collections.filter(
          (collection) => permissions?.collections?.[collection.slug]?.read?.permission,
        ),
        globals: filteredGlobals,
        permissions,
        user,
      }}
    />
  )
}

export default Dashboard
