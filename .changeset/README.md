# Changesets

Every user-visible change gets a changeset: run `pnpm changeset`, pick the bump
(patch until `0.1.0` is out), and describe the change in a sentence a consumer
would care about. CI turns pending changesets into a "Version packages" PR;
merging that PR publishes to npm with provenance.
