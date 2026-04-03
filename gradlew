#!/bin/sh
#
# Gradle startup script for UN*X
#

APP_NAME="Gradle"
APP_BASE_NAME=`basename "$0"`
APP_HOME=`dirname "$0"`
APP_HOME=`cd "$APP_HOME" && pwd`

DEFAULT_JVM_OPTS="-Xmx2048m -Xms512m -XX:+HeapDumpOnOutOfMemoryError"

MAX_FD="maximum"

warn () { echo "$*"; }
die () { echo; echo "$*"; echo; exit 1; }

# OS detection
cygwin=false
darwin=false
msys=false
case "`uname`" in
  CYGWIN*)  cygwin=true  ;;
  Darwin*)  darwin=true  ;;
  MINGW*)   msys=true    ;;
esac

CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"

# Determine Java command
if [ -n "$JAVA_HOME" ]; then
    JAVACMD="$JAVA_HOME/bin/java"
    [ ! -x "$JAVACMD" ] && die "ERROR: JAVA_HOME is set to an invalid directory: $JAVA_HOME"
else
    JAVACMD="java"
    command -v java >/dev/null 2>&1 || die "ERROR: JAVA_HOME is not set and 'java' was not found in PATH."
fi

# Increase file descriptor limit
if [ "$cygwin" = "false" ] && [ "$darwin" = "false" ]; then
    MAX_FD_LIMIT=`ulimit -H -n`
    if [ $? -eq 0 ]; then
        [ "$MAX_FD" = "maximum" ] || [ "$MAX_FD" = "max" ] && MAX_FD="$MAX_FD_LIMIT"
        ulimit -n $MAX_FD 2>/dev/null
    fi
fi

exec "$JAVACMD" \
    $DEFAULT_JVM_OPTS \
    $JAVA_OPTS \
    $GRADLE_OPTS \
    "-Dorg.gradle.appname=$APP_BASE_NAME" \
    -classpath "$CLASSPATH" \
    org.gradle.wrapper.GradleWrapperMain \
    "$@"
