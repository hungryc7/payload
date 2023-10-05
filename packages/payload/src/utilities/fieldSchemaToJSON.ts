import type { Field } from '../fields/config/types'

export const fieldSchemaToJSON = (fields: Field[]): Record<string, unknown>[] => {
  return fields.reduce((acc, field) => {
    let result = acc

    switch (field.type) {
      case 'group':
      case 'array':
        acc.push({
          name: field.name,
          fields: fieldSchemaToJSON(field.fields),
          type: field.type,
        })
        break

      case 'blocks':
        acc.push({
          name: field.name,
          blocks: field.blocks.reduce((acc, block) => {
            acc[block.slug] = {
              fields: fieldSchemaToJSON(block.fields),
            }

            return acc
          }, {}),
          type: field.type,
        })
        break

      case 'row':
      case 'collapsible':
        result = result.concat(fieldSchemaToJSON(field.fields))

        break

      case 'tabs': {
        let tabFields = []

        field.tabs.forEach((tab) => {
          if ('name' in tab) {
            tabFields.push({
              name: tab.name,
              fields: fieldSchemaToJSON(tab.fields),
              type: 'tab',
            })
            return
          }

          tabFields = tabFields.concat(fieldSchemaToJSON(tab.fields))
        })

        result = result.concat(tabFields)

        break
      }

      case 'relationship':
      case 'upload':
        acc.push({
          name: field.name,
          hasMany: 'hasMany' in field ? Boolean(field.hasMany) : false, // TODO: type this
          relationTo: field.relationTo,
          type: field.type,
        })

        break

      default:
        if ('name' in field) {
          acc.push({
            name: field.name,
            type: field.type,
          })
        }
    }

    return result
  }, [])
}
