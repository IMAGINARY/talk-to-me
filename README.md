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

## Building packages for redistribution

First, install the [build tools](https://www.electron.build/multi-platform-build) for your platform. Then, run
```
yarn run dist
```
and check the `dist` folder for the build results.

## Requirement for converting Keras models to Tensorflow.js models

The Tensorflow.js models in `models/<language>`  are generated from the Keras model files `models/<language>.h5` using
the `convert-to-tfjs.sh` script located in the `models` folder. It is normally not necessary to re-do this step, but we
include it here for reasons of reproducibility.
 
The script utilizes `tensorflowjs_converter` that needs to be installed separately.
Having `python` and `virtualenv` installed, it can be done using:
```
virtualenv --no-site-packages venv
. venv/bin/activate
pip install tensorflowjs==1.3.2
```
Other `tensorflowjs` versions might work as well, but will most likely not produce the exact same output files.

## Pushing to the repository

Model files, test and training data are managed via `dvc`. Two remotes are set up for this repository.
The default remote is for pulling only. The `s3remote` points to the same location, but allows pushing as well.
It is necessary for this remote to provide login credentials:
```
 AWS_ACCESS_KEY_ID=your_s3_id AWS_SECRET_ACCESS_KEY=your_s3_secret dvc push -r s3remote
```
Note the space before the definition of the environment variables to avoid storing the credentials in your shells history.
