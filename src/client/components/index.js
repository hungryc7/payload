import React, { Suspense } from 'react';
import { render } from 'react-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import Loading from './views/Loading';
import { SearchParamsProvider } from './utilities/SearchParams';
import { LocaleProvider } from './utilities/Locale';
import { StatusListProvider } from './modules/Status';
import { UserProvider } from './data/User';
import Routes from './Routes';

import '../scss/app.scss';

const Index = () => {
  return (
    <UserProvider>
      <Router>
        <StatusListProvider>
          <SearchParamsProvider>
            <LocaleProvider>
              <Suspense fallback={<Loading />}>
                <Routes />
              </Suspense>
            </LocaleProvider>
          </SearchParamsProvider>
        </StatusListProvider>
      </Router>
    </UserProvider>
  );
};

render(<Index />, document.getElementById('app'));

// Needed for Hot Module Replacement
if (typeof (module.hot) !== 'undefined') {
  module.hot.accept();
}
