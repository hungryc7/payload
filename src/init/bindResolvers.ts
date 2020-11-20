import access from '../auth/graphql/resolvers/access';
import forgotPassword from '../auth/graphql/resolvers/forgotPassword';
import init from '../auth/graphql/resolvers/init';
import login from '../auth/graphql/resolvers/login';
import logout from '../auth/graphql/resolvers/logout';
import me from '../auth/graphql/resolvers/me';
import refresh from '../auth/graphql/resolvers/refresh';
import resetPassword from '../auth/graphql/resolvers/resetPassword';
import verifyEmail from '../auth/graphql/resolvers/verifyEmail';
import unlock from '../auth/graphql/resolvers/unlock';

import create from '../collections/graphql/resolvers/create';
import find from '../collections/graphql/resolvers/find';
import findByID from '../collections/graphql/resolvers/findByID';
import update from '../collections/graphql/resolvers/update';
import deleteResolver from '../collections/graphql/resolvers/delete';

import findOne from '../globals/graphql/resolvers/findOne';
import globalUpdate from '../globals/graphql/resolvers/update';

function bindResolvers(ctx) {
  const payload = ctx;

  payload.graphQL = {
    resolvers: {
      collections: {
        create: create.bind(ctx),
        find: find.bind(ctx),
        findByID: findByID.bind(ctx),
        update: update.bind(ctx),
        deleteResolver: deleteResolver.bind(ctx),
        auth: {
          access: access.bind(ctx),
          forgotPassword: forgotPassword.bind(ctx),
          init: init.bind(ctx),
          login: login.bind(ctx),
          logout: logout.bind(ctx),
          me: me.bind(ctx),
          refresh: refresh.bind(ctx),
          resetPassword: resetPassword.bind(ctx),
          verifyEmail: verifyEmail.bind(ctx),
          unlock: unlock.bind(ctx),
        },
      },
      globals: {
        findOne: findOne.bind(ctx),
        update: globalUpdate.bind(ctx),
      },
    },
  };
}

export default bindResolvers;
