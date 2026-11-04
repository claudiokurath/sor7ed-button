import { expect, it } from 'vitest';
import { accountMessage } from './account-message.js';

it.each(['hi', ' Hello! ', 'hey SOR7ED', 'HI sorted?', 'ACCOUNT', 'my   account', 'menu', 'help', 'sign in', 'sign up', 'login'])('routes %s only to the SOR7ED account', text => {
  const reply = accountMessage(text);
  expect(reply).toContain('https://www.sor7ed.com/account');
  expect(reply).toContain('Sign in or create your account');
  expect(reply).not.toMatch(/planet|guidebook|toolbox/i);
});
it.each(['sign out', 'logout', 'LOG OUT!', 'signout'])('does not silently sign out a browser for %s', text => {
  expect(accountMessage(text)).toBe('To sign out, open your SOR7ED account and choose Sign out.\nhttps://www.sor7ed.com/account');
});
it.each(['STOP', 'START', 'SIGNIN-123456', 'BUTTON-CONNECT-token', 'GET IT SORTED request', 'LIBRARY', 'a random note'])('leaves %s to its own handler', text => {
  expect(accountMessage(text)).toBeNull();
});
