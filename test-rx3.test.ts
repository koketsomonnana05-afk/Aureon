import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { afterAll, beforeAll, describe, it, beforeEach } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-test-project-4',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  it('allows read for alphanumeric uid', async () => {
    const db = testEnv.authenticatedContext('DD2WS0CR41R1lckjiI2xuntlALG3', { email_verified: true }).firestore();
    const docRef = doc(db, 'users', 'DD2WS0CR41R1lckjiI2xuntlALG3');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'DD2WS0CR41R1lckjiI2xuntlALG3'), { xp: 0 });
    });
    await assertSucceeds(getDoc(docRef));
  });

  it('allows create & update', async () => {
    const db = testEnv.authenticatedContext('DD2WS0CR41R1lckjiI2xuntlALG3', { email_verified: true }).firestore();
    const docRef = doc(db, 'users', 'DD2WS0CR41R1lckjiI2xuntlALG3');
    await assertSucceeds(setDoc(docRef, { userId: "DD2WS0CR41R1lckjiI2xuntlALG3", xp: 0, streak: 0 }, { merge: true }));
    
    const docRef2 = doc(db, 'publicProfiles', 'DD2WS0CR41R1lckjiI2xuntlALG3');
    await assertSucceeds(setDoc(docRef2, { userId: "DD2WS0CR41R1lckjiI2xuntlALG3", xp: 0, name: "koketsomonnana05" }));
  });
});
