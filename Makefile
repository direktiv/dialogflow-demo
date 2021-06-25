mkfile_path_main := $(abspath $(lastword $(MAKEFILE_LIST)))
mkfile_dir_main := $(dir $(mkfile_path_main))

.PHONY: build
build:
	if [ ! -d ${mkfile_dir_main}build ]; then \
		mkdir ${mkfile_dir_main}build; \
	fi	

	echo "build frontend"
	cd demo-frontend; yarn install; yarn build;

	echo "build server"
	cd demo-server; go build;

	echo "copy files to build"
	cp -r demo-frontend/build ./build
	cp demo-server/demo-server ./build

.PHONY: clean
clean:
	rm -rf ./build