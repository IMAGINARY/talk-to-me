# Talk to me

This project requires `dvc` and `yarn` installed on your system.

After cloning the repository, retrieve the model and test audio files:
```
dvc fetch
dvc checkout
```

Then install the project dependencies:
```
yarn install
```

Launch the software:
```
yarn run start
```

# Pushing to the repository

Model files, test and training data are managed via `dvc`. Two remotes are set up for this repository.
The default remote is for pulling only. The `s3remote` points to the same location, but allows pushing as well.
It is necessary for this remote to provide login credentials:
```
 AWS_ACCESS_KEY_ID=your_s3_id AWS_SECRET_ACCESS_KEY=your_s3_secret dvc push -r s3remote
```
Note the space before the definition of the environment variables to avoid storing the credentials in your shells history.