module.exports = [
  {
    name: 'resetPasswordToken',
    // TODO: how should we define a field a string that cannot be seen in the admin panel?
    //  using type: 'input' for now
    type: 'text',
    disableAdmin: true,
  },
  {
    name: 'resetPasswordExpiration',
    type: 'date',
  },
];
