import { Option, Action } from './types';

const reduceToIDs = (options) => options.reduce((ids, option) => {
  if (option.options) {
    return [
      ...ids,
      ...reduceToIDs(option.options),
    ];
  }

  return [
    ...ids,
    option.value,
  ];
}, []);

const sortOptions = (options: Option[]): Option[] => options.sort((a: Option, b: Option) => {
  if (typeof a?.label?.localeCompare === 'function' && typeof b?.label?.localeCompare === 'function') {
    return a.label.localeCompare(b.label);
  }

  return 0;
});

const optionsReducer = (state: Option[], action: Action): Option[] => {
  switch (action.type) {
    case 'CLEAR': {
      return [];
    }

    case 'ADD': {
      const { hasMultipleRelations, collection, docs, sort, ids = [] } = action;
      const relation = collection.slug;

      const labelKey = collection.admin.useAsTitle || 'id';

      const loadedIDs = reduceToIDs(state);

      if (!hasMultipleRelations) {
        const options = [
          ...state,
          ...docs.reduce((docOptions, doc) => {
            if (loadedIDs.indexOf(doc.id) === -1) {
              loadedIDs.push(doc.id);
              return [
                ...docOptions,
                {
                  label: doc[labelKey] || `Untitled - ID: ${doc.id}`,
                  value: doc.id,
                },
              ];
            }
            return docOptions;
          }, []),
        ];

        ids.forEach((id) => {
          if (!loadedIDs.includes(id)) {
            options.push({
              label: labelKey === 'id' ? id : `Untitled - ID: ${id}`,
              value: id,
            });
          }
        });

        return sort ? sortOptions(options) : options;
      }

      const newOptions = [...state];
      const optionsToAddTo = newOptions.find((optionGroup) => optionGroup.label === collection.labels.plural);

      const newSubOptions = docs.reduce((docSubOptions, doc) => {
        if (loadedIDs.indexOf(doc.id) === -1) {
          loadedIDs.push(doc.id);

          return [
            ...docSubOptions,
            {
              label: doc[labelKey] || `Untitled - ID: ${doc.id}`,
              relationTo: relation,
              value: doc.id,
            },
          ];
        }

        return docSubOptions;
      }, []);

      ids.forEach((id) => {
        if (!loadedIDs.includes(id)) {
          newSubOptions.push({
            label: labelKey === 'id' ? id : `Untitled - ID: ${id}`,
            value: id,
          });
        }
      });

      if (optionsToAddTo) {
        const subOptions = [
          ...optionsToAddTo.options,
          ...newSubOptions,
        ];

        optionsToAddTo.options = sort ? sortOptions(subOptions) : subOptions;
      } else {
        newOptions.push({
          label: collection.labels.plural,
          options: sort ? sortOptions(newSubOptions) : newSubOptions,
          value: undefined,
        });
      }

      return newOptions;
    }


    default: {
      return state;
    }
  }
};

export default optionsReducer;
