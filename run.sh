#!/bin/bash

read -p "email :" email
read -s -p "password :" password

phantomjs cyworld.js $email $password
