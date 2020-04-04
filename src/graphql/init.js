const graphQLHTTP = require('express-graphql');
const { GraphQLObjectType, GraphQLString, GraphQLSchema } = require('graphql');
const buildType = require('./schema/buildObjectType');
const buildWhereInputType = require('./schema/buildWhereInputType');
const formatName = require('./utilities/formatName');
const withPolicy = require('./resolvers/withPolicy');

const Query = {
  name: 'Query',
  fields: {},
};

// const Mutation = {
//   name: 'Mutation',
//   fields: {},
// };

function init() {
  const userType = new GraphQLObjectType({
    name: 'User',
    fields: {
      id: { type: GraphQLString },
      email: { type: GraphQLString },
    },
  });

  Query.fields.User = {
    type: userType,
    args: {
      id: { type: GraphQLString },
    },
    resolve: (_, { id }) => {
      return {
        id,
        email: 'test',
      };
    },
  };

  Object.keys(this.collections).forEach((collectionKey) => {
    const collection = this.collections[collectionKey];

    const {
      config: {
        policies,
        fields,
        labels: {
          singular: singularLabel,
        },
      },
    } = collection;

    const label = formatName(singularLabel);

    collection.graphQLType = buildType(this.config, {
      name: label,
      fields,
      parent: label,
    });

    collection.graphQLWhereInputType = buildWhereInputType({
      name: label,
      fields,
      parent: label,
    });

    Query.fields[label] = {
      type: collection.graphQLType,
      args: {
        where: { type: collection.graphQLWhereInputType },
      },
      resolve: withPolicy(policies.read, async (_, args, context) => {
        console.log(JSON.stringify(args);
        return {
          image: 'test',
        };
      }),
    };
  });

  const query = new GraphQLObjectType(Query);
  // const mutation = new GraphQLObjectType(Mutation);
  const schema = new GraphQLSchema({ query });

  return graphQLHTTP({ schema });
}

module.exports = init;
