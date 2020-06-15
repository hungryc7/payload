import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import Email from '../Email';
import Password from '../Password';
import Checkbox from '../Checkbox';
import Text from '../Text';
import Button from '../../../elements/Button';
import ConfirmPassword from '../ConfirmPassword';
import useForm from '../../Form/useForm';
import CopyToClipboard from '../../../elements/CopyToClipboard';

import './index.scss';

const baseClass = 'auth-fields';

const Auth = (props) => {
  const { initialData, useAPIKey } = props;
  const [changingPassword, setChangingPassword] = useState(false);
  const { getField } = useForm();

  const enableAPIKey = getField('enableAPIKey');
  const apiKey = getField('apiKey');

  const apiKeyValue = apiKey?.value;

  const APIKeyLabel = useMemo(() => (
    <div className={`${baseClass}__api-key-label`}>
      <span>
        API Key
      </span>
      <CopyToClipboard value={apiKeyValue} />
    </div>
  ), [apiKeyValue]);

  return (
    <div className={baseClass}>
      <Email
        required
        name="email"
        label="Email"
        initialData={initialData?.email}
        autoComplete="email"
      />
      {changingPassword && (
        <div className={`${baseClass}__changing-password`}>
          <Password
            autoComplete="off"
            required
            name="password"
            label="New Password"
          />
          <ConfirmPassword />
          <Button
            size="small"
            buttonStyle="secondary"
            onClick={() => setChangingPassword(false)}
          >
            Cancel
          </Button>
        </div>
      )}
      {!changingPassword && (
        <Button
          size="small"
          buttonStyle="secondary"
          onClick={() => setChangingPassword(true)}
        >
          Change Password
        </Button>
      )}
      {useAPIKey && (
        <div className={`${baseClass}__api-key`}>
          <Checkbox
            initialData={initialData?.enableAPIKey}
            label="Enable API Key"
            name="enableAPIKey"
          />
          {enableAPIKey?.value && (
            <div className={`${baseClass}__api-key-generator`}>
              <Text
                label={APIKeyLabel}
                initialData={initialData?.apiKey}
                name="apiKey"
                readOnly
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

Auth.defaultProps = {
  initialData: undefined,
  useAPIKey: false,
};

Auth.propTypes = {
  fieldTypes: PropTypes.shape({}).isRequired,
  initialData: PropTypes.shape({}),
  useAPIKey: PropTypes.bool,
};

export default Auth;
