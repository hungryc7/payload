import React, { useState, useEffect } from 'react';
import {
  Route, Switch, withRouter, Redirect,
} from 'react-router-dom';
import config from 'payload/config';
import List from './views/collections/List';
import { useUser } from './data/User';
import DefaultTemplate from './templates/Default';
import Dashboard from './views/Dashboard';
import ForgotPassword from './views/ForgotPassword';
import Login from './views/Login';
import Logout from './views/Logout';
import NotFound from './views/NotFound';
import CreateFirstUser from './views/CreateFirstUser';
import Edit from './views/collections/Edit';
import EditGlobal from './views/Global';
import { requests } from '../api';
import ResetPassword from './views/ResetPassword';
import Unauthorized from './views/Unauthorized';
import Account from './views/Account';
import Loading from './elements/Loading';

const {
  admin: { user: userSlug }, routes, collections, globals,
} = config;

const Routes = () => {
  const [initialized, setInitialized] = useState(null);
  const { user, permissions, permissions: { canAccessAdmin } } = useUser();

  useEffect(() => {
    requests.get(`${routes.api}/${userSlug}/init`).then(res => res.json().then((data) => {
      if (data && 'initialized' in data) {
        setInitialized(data.initialized);
      }
    }));
  }, []);

  return (
    <Route
      path={routes.admin}
      render={({ match }) => {
        if (initialized === false) {
          return (
            <Switch>
              <Route path={`${match.url}/create-first-user`}>
                <CreateFirstUser setInitialized={setInitialized} />
              </Route>
              <Route>
                <Redirect to={`${match.url}/create-first-user`} />
              </Route>
            </Switch>
          );
        }

        if (initialized === true) {
          return (
            <Switch>
              <Route path={`${match.url}/login`}>
                <Login />
              </Route>
              <Route path={`${match.url}/logout`}>
                <Logout />
              </Route>
              <Route path={`${match.url}/forgot`}>
                <ForgotPassword />
              </Route>
              <Route path={`${match.url}/reset/:token`}>
                <ResetPassword />
              </Route>

              <Route
                render={() => {
                  if (user) {
                    if (canAccessAdmin) {
                      return (
                        <DefaultTemplate>
                          <Switch>
                            <Route
                              path={`${match.url}/`}
                              exact
                            >
                              <Dashboard />
                            </Route>

                            <Route path={`${match.url}/account`}>
                              <Account />
                            </Route>

                            {collections.map((collection) => {
                              if (permissions?.[collection.slug]?.read?.permission) {
                                return (
                                  <Route
                                    key={`${collection.slug}-list`}
                                    path={`${match.url}/collections/${collection.slug}`}
                                    exact
                                    render={(routeProps) => {
                                      return (
                                        <List
                                          {...routeProps}
                                          collection={collection}
                                        />
                                      );
                                    }}
                                  />
                                );
                              }

                              return null;
                            })}

                            {collections.map((collection) => {
                              if (permissions?.[collection.slug]?.create?.permission) {
                                return (
                                  <Route
                                    key={`${collection.slug}-create`}
                                    path={`${match.url}/collections/${collection.slug}/create`}
                                    exact
                                    render={(routeProps) => {
                                      return (
                                        <Edit
                                          {...routeProps}
                                          collection={collection}
                                        />
                                      );
                                    }}
                                  />
                                );
                              }

                              return null;
                            })}

                            {collections.map((collection) => {
                              if (permissions?.[collection.slug]?.read?.permission) {
                                return (
                                  <Route
                                    key={`${collection.slug}-edit`}
                                    path={`${match.url}/collections/${collection.slug}/:id`}
                                    exact
                                    render={(routeProps) => {
                                      return (
                                        <Edit
                                          isEditing
                                          {...routeProps}
                                          collection={collection}
                                        />
                                      );
                                    }}
                                  />
                                );
                              }

                              return null;
                            })}

                            {globals && globals.map((global) => {
                              if (permissions?.[global.slug]?.read?.permission) {
                                return (
                                  <Route
                                    key={`${global.slug}`}
                                    path={`${match.url}/globals/${global.slug}`}
                                    exact
                                    render={(routeProps) => {
                                      return (
                                        <EditGlobal
                                          {...routeProps}
                                          global={global}
                                        />
                                      );
                                    }}
                                  />
                                );
                              }
                              return null;
                            })}

                            <Route path={`${match.url}*`}>
                              <NotFound />
                            </Route>
                          </Switch>
                        </DefaultTemplate>
                      );
                    }

                    if (canAccessAdmin === false) {
                      return <Unauthorized />;
                    }

                    return <Loading />;
                  }

                  if (user === undefined) {
                    return <Loading />;
                  }
                  return <Redirect to={`${match.url}/login`} />;
                }}
              />
              <Route path={`${match.url}*`}>
                <NotFound />
              </Route>
            </Switch>
          );
        }

        return null;
      }}
    />
  );
};

export default withRouter(Routes);
