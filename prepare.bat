node -v
copy ".\prepare\env\.env" . /Y
xcopy ".\prepare\config\" ".\lib\provisioning\config\" /E /Y
