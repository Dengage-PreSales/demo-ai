/* ============================================================================
   THE FRONT DOOR, EVALUATED RATHER THAN READ.

     node .github/scripts/gate.test.mjs

   Who may start a build, and who is told why they may not, is decided by two
   `if:` expressions in .github/workflows/build-demo.yml. They are the most
   consequential lines in this repository: this workflow reads a website, commits
   to main and starts a deployment, and the repository is public. They were also
   the only lines nothing could test, because a GitHub Actions expression only
   runs inside GitHub Actions.

   So it has failed twice, both times the same way: a request correctly declined
   and nothing said about it.

     16 September 2026. A colleague the repository did not know opened a request.
     Both runs skipped in a second, the issue sat without a word on it, and the
     factory was reported broken. The refuse job was written for that.

     23 September 2026. The refuse job's own message ends "comment retry here".
     A colleague did, sixty six seconds later, before anybody could have added
     them. That is an issue_comment, the refuse job only looked at issues, and
     the retry was declined in silence under a comment promising it would work.

   Neither was a wrong decision. Both were right decisions delivered as silence,
   which a person reads as a broken factory, and no amount of care reading YAML
   catches the third one.

   This reads the two expressions out of the workflow itself and evaluates them
   against a table of situations, including both of the above exactly as they
   happened. It evaluates the real strings: an expression edited in the workflow
   is the expression tested here, and there is no second copy to drift.
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluate, truthy } from './gha-expression.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(HERE, '..', 'workflows', 'build-demo.yml');

/* The evaluator lives in .github/scripts/gha-expression.mjs, because the test
   that checks what arguments a build passes needs the same one. Two copies of a
   GitHub Actions evaluator would be two different opinions about what the
   workflow means, which is worse than having none. */

/* ------------------------------------------------------- the two expressions

   Pulled straight out of the workflow. A hand written copy here would be a
   second list of exactly the kind this repository keeps paying for. */
function conditionOf(job) {
    const text = readFileSync(WORKFLOW, 'utf8');
    const start = text.indexOf('\n  ' + job + ':\n');
    if (start === -1) throw new Error('no job called ' + job + ' in the workflow');
    const marker = text.indexOf('\n    if: >-\n', start);
    if (marker === -1) throw new Error('job ' + job + ' has no if: >- block');
    const lines = text.slice(marker + '\n    if: >-\n'.length).split('\n');
    const kept = [];
    for (const line of lines) {
        if (line.trim() === '') break;
        if (!line.startsWith('      ')) break;
        kept.push(line.trim());
    }
    if (!kept.length) throw new Error('job ' + job + ' has an empty if: block');
    return kept.join(' ');
}

const REFUSE = conditionOf('refuse');
const BUILD = conditionOf('build');

/* ------------------------------------------------------------- the situations */

function situation(over) {
    const base = {
        github: {
            event_name: 'issues',
            event: {
                action: 'opened',
                issue: {
                    number: 21,
                    title: 'Demo: Queima Diaria',
                    labels: [{ name: 'new-demo' }],
                    user: { login: 'jpacanaro' },
                    author_association: 'NONE'
                },
                comment: undefined,
                inputs: {}
            }
        },
        vars: { DEMO_REQUESTERS: '' }
    };
    const merged = JSON.parse(JSON.stringify(base));
    if (over.event_name) merged.github.event_name = over.event_name;
    if (over.action !== undefined) merged.github.event.action = over.action;
    if (over.title !== undefined) merged.github.event.issue.title = over.title;
    if (over.labels !== undefined) merged.github.event.issue.labels = over.labels.map((name) => ({ name }));
    if (over.issueLogin) merged.github.event.issue.user.login = over.issueLogin;
    if (over.issueAssociation) merged.github.event.issue.author_association = over.issueAssociation;
    if (over.comment) {
        merged.github.event.comment = {
            body: over.comment.body,
            user: { login: over.comment.login },
            author_association: over.comment.association || 'NONE'
        };
    }
    if (over.requesters !== undefined) merged.vars.DEMO_REQUESTERS = over.requesters;
    return merged;
}

let pass = 0;
let fail = 0;
function check(label, context, wantRefuse, wantBuild) {
    const gotRefuse = truthy(evaluate(REFUSE, context));
    const gotBuild = truthy(evaluate(BUILD, context));
    if (gotRefuse === wantRefuse && gotBuild === wantBuild) {
        pass++; console.log('   ok    ' + label);
        return;
    }
    fail++;
    console.log('   FAIL  ' + label +
        '  <refuse ' + gotRefuse + ' wanted ' + wantRefuse +
        ', build ' + gotBuild + ' wanted ' + wantBuild + '>');
}

console.log('\n1. Nobody is ever met with silence');

/* THE RULE THE WHOLE FILE IS FOR. Every request shaped event either starts a
   build or gets an answer. Exactly one of the two, never neither. */

console.log('\n   16 September: an unknown account opens a request');
check('the build does not run, and the refusal does',
      situation({ issueLogin: 'jpacanaro', requesters: '' }), true, false);

console.log('\n   23 September: that account comments retry before being added');
check('the retry is declined, and it is answered',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'Retry', login: 'jpacanaro' },
                  requesters: '' }), true, false);

console.log('\n2. A listed requester builds, and is not also refused');
check('an account on the list may open a request',
      situation({ issueLogin: 'jpacanaro', requesters: 'alice jpacanaro carol' }), false, true);
check('and may ask for a retry',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'retry please', login: 'jpacanaro' },
                  requesters: 'alice jpacanaro carol' }), false, true);
check('a capitalised Retry is the same word',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'Retry', login: 'jpacanaro' },
                  requesters: 'jpacanaro' }), false, true);
check('the owner never needs the list',
      situation({ issueAssociation: 'OWNER', requesters: '' }), false, true);
check('nor does a collaborator asking for a retry',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'retry', login: 'someone', association: 'COLLABORATOR' },
                  requesters: '' }), false, true);

console.log('\n3. One login can never match inside another');
check('bob is not admitted by bobby being listed',
      situation({ issueLogin: 'bob', requesters: 'alice bobby carol' }), true, false);
check('and bobby still is',
      situation({ issueLogin: 'bobby', requesters: 'alice bobby carol' }), false, true);
check('a name at the start of the list is found',
      situation({ issueLogin: 'alice', requesters: 'alice bobby carol' }), false, true);
check('and a name at the end of it',
      situation({ issueLogin: 'carol', requesters: 'alice bobby carol' }), false, true);

console.log('\n4. The separator the message now names, and the ones that fail');

/* THIS IS THE TRAP THE REFUSAL MESSAGE EXISTS TO PREVENT rather than a rule
   worth having. A list written with commas matches nothing, and from outside it
   looks exactly like not having been added, so the owner adds the name again and
   again and the factory looks broken. The gate cannot repair the text: a GitHub
   Actions expression has no way to replace one character with another. So the
   message says the format, and these two assertions are here to keep the
   message honest about what really happens. */
check('spaces work, which is what the refusal tells the owner to use',
      situation({ issueLogin: 'jpacanaro', requesters: 'alice jpacanaro' }), false, true);
check('commas do not, and the refusal says so in as many words',
      situation({ issueLogin: 'jpacanaro', requesters: 'alice,jpacanaro' }), true, false);

console.log('\n5. A stranger cannot start a build by wearing somebody else\'s issue');
check('a retry from an unlisted account on a listed account\'s request is declined',
      situation({ event_name: 'issue_comment', action: 'created',
                  issueLogin: 'jpacanaro',
                  comment: { body: 'retry', login: 'passer-by' },
                  requesters: 'jpacanaro' }), true, false);

console.log('\n6. Ordinary traffic is left alone');
check('a comment that does not ask for a retry starts nothing and says nothing',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'Looks great, thanks', login: 'jpacanaro' },
                  requesters: 'jpacanaro' }), false, false);
check('an issue that is not a request is not a request',
      situation({ title: 'The wishlist button is the wrong colour', labels: [],
                  issueLogin: 'jpacanaro', requesters: 'jpacanaro' }), false, false);
check('and an unknown account opening an ordinary issue is not refused at it',
      situation({ title: 'A question about the demos', labels: [],
                  issueLogin: 'stranger', requesters: '' }), false, false);

console.log('\n7. One request is one build');

/* The issue form creates the issue and applies the label in one action, so
   GitHub delivers opened and labeled a second apart. Both matching means one
   request builds twice, takes a numbered slug the second time, and publishes a
   duplicate. */
check('opened builds it',
      situation({ action: 'opened', requesters: 'jpacanaro' }), false, true);
check('and the labeled event that follows it does not build it again',
      situation({ action: 'labeled', requesters: 'jpacanaro' }), false, false);
check('while a hand made issue labelled afterwards still builds',
      situation({ action: 'labeled', title: 'Please build acme-tools',
                  requesters: 'jpacanaro' }), false, true);

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
