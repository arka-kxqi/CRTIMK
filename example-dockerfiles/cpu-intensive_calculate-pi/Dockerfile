# https://adventuresindata.netlify.app/post/2018-01-08-benchmark-bash/
FROM alpine

RUN apk update && apk add --no-cache bc

#Calculate pi to 5000 digits
CMD ["echo", "scale=5000; 4*a(1)",  "|",  "bc -l"]